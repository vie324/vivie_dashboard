import { NextResponse } from 'next/server';
import { squareClient, squareLocationIds, safeJson } from '@/lib/square/client';
import { createClient, createServiceClient, getServiceRoleStatus } from '@/lib/supabase/server';

// Square SDK のエラーから人間に分かりやすいメッセージを抽出
function describeSquareError(err: unknown, step: string): string {
  const e = err as any;
  if (e?.errors && Array.isArray(e.errors) && e.errors.length > 0) {
    const first = e.errors[0];
    return `[${step}] ${first.category ?? ''} ${first.code ?? ''}: ${first.detail ?? first.message ?? ''}`;
  }
  if (e?.result?.errors?.[0]) {
    const first = e.result.errors[0];
    return `[${step}] ${first.category ?? ''} ${first.code ?? ''}: ${first.detail ?? first.message ?? ''}`;
  }
  if (e?.message) return `[${step}] ${e.message}`;
  return `[${step}] unknown error`;
}

// Square から顧客・サブスクリプションを取得して Supabase に upsert
export async function POST() {
  const supabaseAuth = createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'SQUARE_ACCESS_TOKEN が未設定です。Vercel の環境変数を確認してください。' },
      { status: 500 },
    );
  }

  // service_role キーが正しく設定されているか検証
  const sr = getServiceRoleStatus();
  if (!sr.ok) {
    return NextResponse.json(
      {
        error: sr.reason ?? 'SUPABASE_SERVICE_ROLE_KEY が不正です',
        hint: 'Supabase ダッシュボード > Settings > API から "service_role" secret を取得し、Vercel 環境変数を更新してください',
      },
      { status: 500 },
    );
  }

  const result = {
    members: 0,
    subscriptions: 0,
    plans: 0,
    warnings: [] as string[],
  };

  let sq: ReturnType<typeof squareClient>;
  try {
    sq = squareClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'square client init failed' },
      { status: 500 },
    );
  }
  const supabase = createServiceClient();

  // 1) Catalog: SUBSCRIPTION_PLAN と SUBSCRIPTION_PLAN_VARIATION を取得
  // Square では PLAN は親(名前のみ)、VARIATION が実際の価格を持つ
  // Subscription.planVariationId は VARIATION を参照するため、両方保存して
  // VARIATION 側を square_plan_id にマッピングする
  try {
    // 親プランの名前を引くために Map で保持
    const planNameById = new Map<string, string>();

    const parentRes = await sq.catalogApi.searchCatalogObjects({
      objectTypes: ['SUBSCRIPTION_PLAN'],
      limit: 100,
    });
    for (const obj of parentRes.result.objects ?? []) {
      const data = (obj as any).subscriptionPlanData;
      if (data?.name && obj.id) planNameById.set(obj.id, data.name);
    }

    // VARIATION (価格を持つ単位)
    const varRes = await sq.catalogApi.searchCatalogObjects({
      objectTypes: ['SUBSCRIPTION_PLAN_VARIATION'],
      limit: 100,
    });
    for (const obj of varRes.result.objects ?? []) {
      const variation = (obj as any).subscriptionPlanVariationData;
      if (!variation) continue;

      // 価格は phases[*].pricing.price (新) または recurringPriceMoney (旧) に存在
      const phases: any[] = variation.phases ?? [];
      const findRecurring = (p: any) =>
        ['MONTHLY', 'EVERY_30_DAYS', 'EVERY_4_WEEKS', 'EVERY_MONTH'].includes(p?.cadence);
      const monthlyPhase = phases.find(findRecurring) ?? phases[0];
      const priceAmount =
        monthlyPhase?.pricing?.price?.amount ??
        monthlyPhase?.pricing?.priceMoney?.amount ??
        monthlyPhase?.recurringPriceMoney?.amount ??
        0;
      const monthlyPrice = Number(priceAmount) || 0;

      const parentName = variation.subscriptionPlanId
        ? planNameById.get(variation.subscriptionPlanId)
        : null;
      const variationName = variation.name ?? null;
      const displayName =
        parentName && variationName
          ? `${parentName} (${variationName})`
          : variationName || parentName || '名称未設定';

      const { error: planErr } = await supabase.from('subscription_plans').upsert(
        {
          square_plan_id: obj.id,
          name: displayName,
          monthly_price: monthlyPrice,
          is_active: !obj.isDeleted,
        },
        { onConflict: 'square_plan_id' },
      );
      if (planErr) {
        result.warnings.push(`[plans/${obj.id}] ${planErr.message}`);
      } else {
        result.plans++;
      }
    }
  } catch (err) {
    result.warnings.push(describeSquareError(err, 'catalog'));
    console.error('catalog sync failed', err);
  }

  // 2) Customers (これが失敗したら止める)
  // listCustomers は undefined 引数で URL が壊れる SDK バグがあるため
  // body ベースの searchCustomers を使用
  try {
    let cursor: string | undefined;
    do {
      const reqBody: any = {
        limit: 100,
        query: { sort: { field: 'CREATED_AT', order: 'DESC' } },
      };
      if (cursor) reqBody.cursor = cursor;
      const res = await sq.customersApi.searchCustomers(reqBody);
      const customers = res.result.customers ?? [];
      for (const c of customers) {
        const fullName =
          [c.givenName, c.familyName].filter(Boolean).join(' ').trim() ||
          c.companyName ||
          '名前未設定';
        const { error: memberErr } = await supabase.from('members').upsert(
          {
            square_customer_id: c.id!,
            source: 'square' as const,
            full_name: fullName,
            email: c.emailAddress ?? null,
            phone: c.phoneNumber ?? null,
            address: c.address?.addressLine1 ?? null,
            joined_at: c.createdAt ? c.createdAt.slice(0, 10) : null,
            status: 'active' as const,
          },
          { onConflict: 'square_customer_id' },
        );
        if (memberErr) {
          result.warnings.push(`[members/${c.id?.slice(0, 8)}] ${memberErr.message}`);
          console.error('member upsert failed', c.id, memberErr);
        } else {
          result.members++;
        }
      }
      cursor = res.result.cursor;
    } while (cursor);
  } catch (err) {
    return NextResponse.json(
      {
        error: describeSquareError(err, 'customers'),
        partial: safeJson(result),
        hint: 'Access Token / Environment (production/sandbox) を確認してください',
      },
      { status: 500 },
    );
  }

  // 3) Subscriptions (location 単位で検索)
  const locations = squareLocationIds();
  if (locations.length === 0) {
    result.warnings.push(
      '[subscriptions] SQUARE_LOCATION_IDS が未設定のためサブスク同期をスキップしました',
    );
  } else {
    for (const locationId of locations) {
      try {
        let subCursor: string | undefined;
        do {
          const requestBody: any = {
            query: { filter: { locationIds: [locationId] } },
            limit: 100,
          };
          if (subCursor) requestBody.cursor = subCursor;
          const subRes = await sq.subscriptionsApi.searchSubscriptions(requestBody);
          const subs = subRes.result.subscriptions ?? [];
          for (const s of subs) {
            if (!s.customerId) continue;
            const { data: member } = await supabase
              .from('members')
              .select('id')
              .eq('square_customer_id', s.customerId)
              .maybeSingle();
            if (!member) continue;

            let planRowId: string | null = null;
            const planSquareId = s.planVariationId || s.planId;
            if (planSquareId) {
              const { data: plan } = await supabase
                .from('subscription_plans')
                .select('id')
                .eq('square_plan_id', planSquareId)
                .maybeSingle();
              planRowId = (plan as any)?.id ?? null;
            }

            const { error: subErr } = await supabase.from('member_subscriptions').upsert(
              {
                square_subscription_id: s.id!,
                member_id: (member as any).id,
                plan_id: planRowId,
                status: s.status ?? 'UNKNOWN',
                started_at: s.startDate ?? null,
                next_billing_at: s.chargedThroughDate ?? null,
                cancelled_at: s.canceledDate ?? null,
              },
              { onConflict: 'square_subscription_id' },
            );
            if (subErr) {
              result.warnings.push(`[sub/${s.id?.slice(0, 8)}] ${subErr.message}`);
              console.error('subscription upsert failed', s.id, subErr);
            } else {
              result.subscriptions++;
            }
          }
          subCursor = subRes.result.cursor;
        } while (subCursor);
      } catch (err) {
        result.warnings.push(describeSquareError(err, `subscriptions/${locationId}`));
        console.error('subscription sync failed for', locationId, err);
      }
    }
  }

  return NextResponse.json(safeJson({ ok: true, ...result }));
}
