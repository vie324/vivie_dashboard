import { NextRequest, NextResponse } from 'next/server';
import {
  squareClient,
  squareLocationIds,
  safeJson,
  describeSquareError,
} from '@/lib/square/client';
import { recordPayment, recordRefund } from '@/lib/square/payments';
import { createServiceClient, getServiceRoleStatus } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { joinJaName, jstDateFromISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SyncResult = {
  plans: number;
  members: number;
  subscriptions: number;
  payments: number;
  refunds: number;
  warnings: string[];
};

// Square → Supabase の全量同期。
//  1) カタログ (サブスクプラン)   2) 顧客   3) サブスク契約
//  4) 決済 (完了分)              5) 返金
// Webhook の取りこぼしがあっても、この同期で決済ベースの売上が必ず揃う。
async function runSync(lookbackDays: number): Promise<
  | { ok: true; result: SyncResult }
  | { ok: false; status: number; error: string; partial?: SyncResult; hint?: string }
> {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return {
      ok: false,
      status: 500,
      error: 'SQUARE_ACCESS_TOKEN が未設定です。Vercel の環境変数を確認してください。',
    };
  }
  const sr = getServiceRoleStatus();
  if (!sr.ok) {
    return {
      ok: false,
      status: 500,
      error: sr.reason ?? 'SUPABASE_SERVICE_ROLE_KEY が不正です',
      hint: 'Supabase ダッシュボード > Settings > API から "service_role" secret を取得し、Vercel 環境変数を更新してください',
    };
  }

  let sq: ReturnType<typeof squareClient>;
  try {
    sq = squareClient();
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'square client init failed',
    };
  }
  const supabase = createServiceClient();
  const result: SyncResult = {
    plans: 0,
    members: 0,
    subscriptions: 0,
    payments: 0,
    refunds: 0,
    warnings: [],
  };

  // ---------------------------------------------------------------
  // 1) カタログ: SUBSCRIPTION_PLAN (親: 名前) と VARIATION (価格・周期)
  //    Subscription.planVariationId は VARIATION を参照するため、
  //    VARIATION 側を square_plan_id にマッピングする。
  // ---------------------------------------------------------------
  try {
    const planNameById = new Map<string, string>();
    let cursor: string | undefined;
    do {
      const res = await sq.catalogApi.searchCatalogObjects({
        objectTypes: ['SUBSCRIPTION_PLAN'],
        includeDeletedObjects: true,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      for (const obj of res.result.objects ?? []) {
        const data = (obj as any).subscriptionPlanData;
        if (data?.name && obj.id) planNameById.set(obj.id, data.name);
      }
      cursor = res.result.cursor ?? undefined;
    } while (cursor);

    cursor = undefined;
    do {
      const res = await sq.catalogApi.searchCatalogObjects({
        objectTypes: ['SUBSCRIPTION_PLAN_VARIATION'],
        includeDeletedObjects: true,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      for (const obj of res.result.objects ?? []) {
        const variation = (obj as any).subscriptionPlanVariationData;
        if (!variation) continue;

        // 価格・周期は最後のフェーズ (evergreen。最初のフェーズは無料トライアルの
        // ことがある) から取得する。
        const phases: any[] = variation.phases ?? [];
        const evergreen = phases[phases.length - 1] ?? null;
        const priceAmount =
          evergreen?.pricing?.price?.amount ??
          evergreen?.pricing?.priceMoney?.amount ??
          evergreen?.recurringPriceMoney?.amount ??
          0;
        const cadence: string | null = evergreen?.cadence ?? null;

        const parentName = variation.subscriptionPlanId
          ? planNameById.get(variation.subscriptionPlanId)
          : null;
        const variationName = variation.name ?? null;
        const displayName =
          parentName && variationName
            ? `${parentName} (${variationName})`
            : variationName || parentName || '名称未設定';

        const { error } = await supabase.from('subscription_plans').upsert(
          {
            square_plan_id: obj.id,
            name: displayName,
            monthly_price: Number(priceAmount) || 0,
            cadence,
            is_active: !obj.isDeleted,
          },
          { onConflict: 'square_plan_id' },
        );
        if (error) result.warnings.push(`[plans/${obj.id}] ${error.message}`);
        else result.plans++;
      }
      cursor = res.result.cursor ?? undefined;
    } while (cursor);
  } catch (err) {
    result.warnings.push(describeSquareError(err, 'catalog'));
    console.error('catalog sync failed', err);
  }

  // ---------------------------------------------------------------
  // 2) 顧客 (これが失敗したら中断)
  //    既存会員のステータス・入会日は上書きしない (手動運用を壊さない)。
  // ---------------------------------------------------------------
  try {
    let cursor: string | undefined;
    do {
      const res = await sq.customersApi.searchCustomers({
        limit: 100,
        query: { sort: { field: 'CREATED_AT', order: 'DESC' } },
        ...(cursor ? { cursor } : {}),
      } as any);
      const customers = (res.result.customers ?? []).filter((c) => c.id);

      if (customers.length > 0) {
        const ids = customers.map((c) => c.id!) as string[];
        const { data: existingRows, error: selErr } = await supabase
          .from('members')
          .select('square_customer_id')
          .in('square_customer_id', ids);
        if (selErr) throw new Error(selErr.message);
        const existing = new Set((existingRows ?? []).map((r: any) => r.square_customer_id));

        const toRow = (c: any) => ({
          square_customer_id: c.id as string,
          source: 'square' as const,
          full_name: joinJaName(c.familyName, c.givenName, c.companyName),
          email: c.emailAddress ?? null,
          phone: c.phoneNumber ?? null,
          address: c.address?.addressLine1 ?? null,
        });

        const newRows = customers
          .filter((c) => !existing.has(c.id))
          .map((c) => ({
            ...toRow(c),
            joined_at: c.createdAt ? jstDateFromISO(c.createdAt) : null,
            status: 'active' as const,
          }));
        const updateRows = customers.filter((c) => existing.has(c.id)).map(toRow);

        if (newRows.length > 0) {
          const { error } = await supabase
            .from('members')
            .upsert(newRows, { onConflict: 'square_customer_id' });
          if (error) result.warnings.push(`[members/insert] ${error.message}`);
          else result.members += newRows.length;
        }
        if (updateRows.length > 0) {
          // status / joined_at を含めないことで既存会員の運用情報を保持する
          const { error } = await supabase
            .from('members')
            .upsert(updateRows, { onConflict: 'square_customer_id' });
          if (error) result.warnings.push(`[members/update] ${error.message}`);
          else result.members += updateRows.length;
        }
      }
      cursor = res.result.cursor ?? undefined;
    } while (cursor);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: describeSquareError(err, 'customers'),
      partial: safeJson(result),
      hint: 'Access Token / Environment (production/sandbox) を確認してください',
    };
  }

  // ---------------------------------------------------------------
  // 3) サブスク契約 (location 単位)
  // ---------------------------------------------------------------
  const locations = squareLocationIds();
  if (locations.length === 0) {
    result.warnings.push(
      '[subscriptions] SQUARE_LOCATION_IDS が未設定のためサブスク・決済同期をスキップしました',
    );
  } else {
    // plan / member のルックアップを先に構築して N+1 を避ける
    const { data: planRows } = await supabase
      .from('subscription_plans')
      .select('id, square_plan_id');
    const planIdBySquareId = new Map<string, string>(
      (planRows ?? [])
        .filter((p: any) => p.square_plan_id)
        .map((p: any) => [p.square_plan_id, p.id]),
    );

    for (const locationId of locations) {
      try {
        let cursor: string | undefined;
        do {
          const res = await sq.subscriptionsApi.searchSubscriptions({
            query: { filter: { locationIds: [locationId] } },
            limit: 100,
            ...(cursor ? { cursor } : {}),
          } as any);
          const subs = (res.result.subscriptions ?? []).filter((s) => s.id && s.customerId);

          if (subs.length > 0) {
            const customerIds = Array.from(new Set(subs.map((s) => s.customerId!)));
            const { data: memberRows } = await supabase
              .from('members')
              .select('id, square_customer_id')
              .in('square_customer_id', customerIds);
            const memberIdByCustomer = new Map<string, string>(
              (memberRows ?? []).map((m: any) => [m.square_customer_id, m.id]),
            );

            const rows = [] as any[];
            let unknownMembers = 0;
            for (const s of subs) {
              const memberId = memberIdByCustomer.get(s.customerId!);
              if (!memberId) {
                unknownMembers++;
                continue;
              }
              rows.push({
                square_subscription_id: s.id!,
                member_id: memberId,
                plan_id: s.planVariationId
                  ? planIdBySquareId.get(s.planVariationId) ?? null
                  : null,
                status: s.status ?? 'UNKNOWN',
                started_at: s.startDate ?? null,
                next_billing_at: s.chargedThroughDate ?? null,
                cancelled_at: s.canceledDate ?? null,
              });
            }
            if (unknownMembers > 0) {
              result.warnings.push(
                `[subscriptions/${locationId}] 会員未同期のため ${unknownMembers} 件スキップ`,
              );
            }
            if (rows.length > 0) {
              const { error } = await supabase
                .from('member_subscriptions')
                .upsert(rows, { onConflict: 'square_subscription_id' });
              if (error) result.warnings.push(`[subscriptions/${locationId}] ${error.message}`);
              else result.subscriptions += rows.length;
            }
          }
          cursor = res.result.cursor ?? undefined;
        } while (cursor);
      } catch (err) {
        result.warnings.push(describeSquareError(err, `subscriptions/${locationId}`));
        console.error('subscription sync failed for', locationId, err);
      }
    }

    // ---------------------------------------------------------------
    // 4) 決済 (完了分) — Webhook 取りこぼしのバックフィル
    // ---------------------------------------------------------------
    const beginTime = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    for (const locationId of locations) {
      try {
        let cursor: string | undefined;
        do {
          const res = await sq.paymentsApi.listPayments(
            beginTime,
            undefined,
            'DESC',
            cursor,
            locationId,
            undefined,
            undefined,
            undefined,
            100,
          );
          const payments = (res.result.payments ?? []).filter(
            (p) => p.id && p.status === 'COMPLETED',
          );

          if (payments.length > 0) {
            // 既に記帳済みの決済はスキップして無駄なクエリを避ける
            const ids = payments.map((p) => p.id!) as string[];
            const { data: existingRows } = await supabase
              .from('cashbook_entries')
              .select('square_payment_id')
              .in('square_payment_id', ids);
            const recorded = new Set(
              (existingRows ?? []).map((r: any) => r.square_payment_id),
            );

            for (const p of payments) {
              if (recorded.has(p.id)) continue;
              const r = await recordPayment(supabase, {
                id: p.id!,
                status: p.status ?? null,
                amount: Number(p.totalMoney?.amount ?? p.amountMoney?.amount ?? 0),
                locationId: p.locationId ?? null,
                customerId: p.customerId ?? null,
                orderId: p.orderId ?? null,
                createdAt: p.createdAt ?? null,
              });
              if (!r.ok) result.warnings.push(r.error);
              else if (!r.skipped) result.payments++;
              else if (r.skipped.startsWith('store_unmapped')) {
                result.warnings.push(
                  `[payments/${locationId}] stores.square_location_id が未設定のため記帳できません (${r.skipped})`,
                );
                break; // この location は全件同じ理由で落ちるため打ち切る
              }
            }
          }
          cursor = res.result.cursor ?? undefined;
        } while (cursor);
      } catch (err) {
        result.warnings.push(describeSquareError(err, `payments/${locationId}`));
        console.error('payments sync failed for', locationId, err);
      }
    }

    // ---------------------------------------------------------------
    // 5) 返金 — 売上の過大計上を防ぐ
    // ---------------------------------------------------------------
    for (const locationId of locations) {
      try {
        let cursor: string | undefined;
        do {
          const res = await sq.refundsApi.listPaymentRefunds(
            beginTime,
            undefined,
            'DESC',
            cursor,
            locationId,
            'COMPLETED',
            undefined,
            100,
          );
          const refunds = (res.result.refunds ?? []).filter((r) => r.id);

          if (refunds.length > 0) {
            const ids = refunds.map((r) => r.id!) as string[];
            const { data: existingRows } = await supabase
              .from('cashbook_entries')
              .select('square_payment_id')
              .in('square_payment_id', ids);
            const recorded = new Set(
              (existingRows ?? []).map((r: any) => r.square_payment_id),
            );

            for (const r of refunds) {
              if (recorded.has(r.id)) continue;
              const rr = await recordRefund(supabase, {
                id: r.id!,
                status: r.status ?? null,
                amount: Number(r.amountMoney?.amount ?? 0),
                locationId: r.locationId ?? null,
                paymentId: r.paymentId ?? null,
                createdAt: r.createdAt ?? null,
              });
              if (!rr.ok) result.warnings.push(rr.error);
              else if (!rr.skipped) result.refunds++;
            }
          }
          cursor = res.result.cursor ?? undefined;
        } while (cursor);
      } catch (err) {
        result.warnings.push(describeSquareError(err, `refunds/${locationId}`));
        console.error('refunds sync failed for', locationId, err);
      }
    }
  }

  return { ok: true, result };
}

function parseLookbackDays(request: NextRequest, fallback: number): number {
  const raw = Number(request.nextUrl.searchParams.get('days'));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(365, Math.max(1, Math.floor(raw)));
}

// 手動同期 (画面の「Square 同期」ボタン)。admin / manager のみ。
export async function POST(request: NextRequest) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (staff.role !== 'admin' && staff.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const outcome = await runSync(parseLookbackDays(request, 90));
  if (!outcome.ok) {
    const { status, ...body } = outcome;
    return NextResponse.json(body, { status });
  }
  return NextResponse.json(safeJson({ ok: true, ...outcome.result }));
}

// Vercel Cron からの定期同期 (毎日)。CRON_SECRET があれば Bearer で検証、
// 無ければ管理者ログインを要求する。
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else {
    const staff = await getCurrentStaff();
    if (!staff || (staff.role !== 'admin' && staff.role !== 'manager')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const outcome = await runSync(parseLookbackDays(request, 35));
  if (!outcome.ok) {
    const { status, ...body } = outcome;
    return NextResponse.json(body, { status });
  }
  return NextResponse.json(safeJson({ ok: true, ...outcome.result }));
}
