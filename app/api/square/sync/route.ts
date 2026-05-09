import { NextResponse } from 'next/server';
import { squareClient, squareLocationIds, safeJson } from '@/lib/square/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Square から顧客・サブスクリプションを取得して Supabase に upsert
export async function POST() {
  const supabaseAuth = createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let imported = 0;
  let subsImported = 0;
  let plansImported = 0;

  try {
    const sq = squareClient();
    const supabase = createServiceClient();

    // 1) Catalog: SUBSCRIPTION_PLAN を取得
    const catalogRes = await sq.catalogApi.searchCatalogObjects({
      objectTypes: ['SUBSCRIPTION_PLAN'],
      limit: 100,
    });
    const planObjects = catalogRes.result.objects ?? [];
    for (const obj of planObjects) {
      const plan = (obj as any).subscriptionPlanData;
      if (!plan) continue;
      const phases: any[] = plan.phases ?? [];
      const monthlyPhase = phases[0];
      const monthlyPrice = monthlyPhase?.recurringPriceMoney?.amount
        ? Number(monthlyPhase.recurringPriceMoney.amount)
        : 0;
      await supabase
        .from('subscription_plans')
        .upsert(
          {
            square_plan_id: obj.id,
            name: plan.name ?? '名称未設定',
            monthly_price: monthlyPrice,
            is_active: !obj.isDeleted,
          },
          { onConflict: 'square_plan_id' },
        );
      plansImported++;
    }

    // 2) Customers
    let cursor: string | undefined;
    do {
      const res = await sq.customersApi.listCustomers(cursor, 100, undefined, 'DESC');
      const customers = res.result.customers ?? [];
      for (const c of customers) {
        const fullName = [c.givenName, c.familyName].filter(Boolean).join(' ').trim() || c.companyName || '名前未設定';
        await supabase.from('members').upsert(
          {
            square_customer_id: c.id!,
            source: 'square' as const,
            full_name: fullName,
            email: c.emailAddress ?? null,
            phone: c.phoneNumber ?? null,
            address: c.address?.addressLine1 ?? null,
            joined_at: c.createdAt ? c.createdAt.slice(0, 10) : null,
          },
          { onConflict: 'square_customer_id' },
        );
        imported++;
      }
      cursor = res.result.cursor;
    } while (cursor);

    // 3) Subscriptions (location 単位で検索)
    const locations = squareLocationIds();
    for (const locationId of locations) {
      let subCursor: string | undefined;
      do {
        const subRes = await sq.subscriptionsApi.searchSubscriptions({
          query: { filter: { locationIds: [locationId] } },
          cursor: subCursor,
          limit: 100,
        });
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
          if (s.planVariationId || s.planId) {
            const planSquareId = s.planVariationId || s.planId;
            const { data: plan } = await supabase
              .from('subscription_plans')
              .select('id')
              .eq('square_plan_id', planSquareId!)
              .maybeSingle();
            planRowId = plan?.id ?? null;
          }

          await supabase.from('member_subscriptions').upsert(
            {
              square_subscription_id: s.id!,
              member_id: member.id,
              plan_id: planRowId,
              status: s.status ?? 'UNKNOWN',
              started_at: s.startDate ?? null,
              next_billing_at: s.chargedThroughDate ?? null,
              cancelled_at: s.canceledDate ?? null,
            },
            { onConflict: 'square_subscription_id' },
          );
          subsImported++;
        }
        subCursor = subRes.result.cursor;
      } while (subCursor);
    }

    return NextResponse.json(
      safeJson({ ok: true, members: imported, subscriptions: subsImported, plans: plansImported }),
    );
  } catch (err) {
    console.error('square sync error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'sync failed' },
      { status: 500 },
    );
  }
}
