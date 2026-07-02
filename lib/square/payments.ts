import type { SupabaseClient } from '@supabase/supabase-js';
import { jstDateFromISO } from '@/lib/utils';
import type { SaleKind } from '@/types/database';

// Square 決済 / 返金 → 出納帳 (cashbook_entries) への記帳ロジック。
// Webhook (snake_case JSON) と同期 API (SDK camelCase) の両方から使うため、
// 正規化した形で受け取る。square_payment_id の一意インデックスにより
// 再送・二重取り込みは DO NOTHING で冪等になる。

export const REFUND_CATEGORY = '返金 (Square)';

export type NormalizedPayment = {
  id: string;
  status: string | null;
  amount: number; // JPY (税・チップ込みの決済総額)
  locationId: string | null;
  customerId: string | null;
  orderId: string | null;
  createdAt: string | null;
};

export type NormalizedRefund = {
  id: string;
  status: string | null;
  amount: number;
  locationId: string | null;
  paymentId: string | null;
  createdAt: string | null;
};

export type RecordResult =
  | { ok: true; skipped?: string }
  | { ok: false; error: string };

async function storeIdForLocation(
  supabase: SupabaseClient<any>,
  locationId: string | null,
): Promise<string | null> {
  if (!locationId) return null;
  const { data } = await supabase
    .from('stores')
    .select('id')
    .eq('square_location_id', locationId)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

// 完了済み決済を出納帳へ記帳する。既に同じ square_payment_id の行があれば何もしない
// (手動で区分・メモを修正した行を webhook 再送で上書きしないため)。
export async function recordPayment(
  supabase: SupabaseClient<any>,
  p: NormalizedPayment,
): Promise<RecordResult> {
  if (p.status !== 'COMPLETED' || !(p.amount > 0)) {
    return { ok: true, skipped: 'not_completed' };
  }
  const storeId = await storeIdForLocation(supabase, p.locationId);
  if (!storeId) {
    return { ok: true, skipped: `store_unmapped:${p.locationId ?? 'unknown'}` };
  }

  // サブスク課金かどうかを判定する。Square の payment は subscription_id を直接
  // 持たないため、顧客の有効サブスクの月額と金額一致するかで推定する。
  let saleKind: SaleKind = 'single';
  let matchedSubscriptionId: string | null = null;
  let relatedMemberId: string | null = null;

  if (p.customerId) {
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('square_customer_id', p.customerId)
      .maybeSingle();
    relatedMemberId = (member as any)?.id ?? null;

    if (relatedMemberId) {
      const { data: subs } = await supabase
        .from('member_subscriptions')
        .select('square_subscription_id, status, plan:subscription_plans(monthly_price)')
        .eq('member_id', relatedMemberId)
        .in('status', ['ACTIVE', 'active']);
      const match = (subs ?? []).find(
        (s: any) => Number(s.plan?.monthly_price ?? -1) === p.amount,
      );
      if (match) {
        saleKind = 'subscription';
        matchedSubscriptionId = (match as any).square_subscription_id ?? null;
      }
    }
  }

  const { error } = await supabase.from('cashbook_entries').upsert(
    {
      store_id: storeId,
      entry_date: jstDateFromISO(p.createdAt),
      entry_type: 'income' as const,
      source: 'square' as const,
      category: saleKind === 'subscription' ? 'サブスク売上' : 'Square 決済',
      amount: p.amount,
      description: `Square Payment ${p.id}`,
      square_payment_id: p.id,
      square_order_id: p.orderId,
      square_subscription_id: matchedSubscriptionId,
      sale_kind: saleKind,
      related_member_id: relatedMemberId,
    },
    { onConflict: 'square_payment_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: `[payment/${p.id}] ${error.message}` };
  return { ok: true };
}

// 完了済み返金を出納帳へ支出として記帳する。元の決済行から売上区分と会員を引き継ぐ。
export async function recordRefund(
  supabase: SupabaseClient<any>,
  r: NormalizedRefund,
): Promise<RecordResult> {
  if (r.status !== 'COMPLETED' || !(r.amount > 0)) {
    return { ok: true, skipped: 'not_completed' };
  }

  // 元決済の行 (store / 会員 / 売上区分を引き継ぐ)
  let original: any = null;
  if (r.paymentId) {
    const { data } = await supabase
      .from('cashbook_entries')
      .select('store_id, sale_kind, related_member_id')
      .eq('square_payment_id', r.paymentId)
      .maybeSingle();
    original = data;
  }

  const storeId = original?.store_id ?? (await storeIdForLocation(supabase, r.locationId));
  if (!storeId) {
    return { ok: true, skipped: `store_unmapped:${r.locationId ?? 'unknown'}` };
  }

  const { error } = await supabase.from('cashbook_entries').upsert(
    {
      store_id: storeId,
      entry_date: jstDateFromISO(r.createdAt),
      entry_type: 'expense' as const,
      source: 'square' as const,
      category: REFUND_CATEGORY,
      amount: r.amount,
      description: `Square Refund ${r.id}${r.paymentId ? ` (payment ${r.paymentId})` : ''}`,
      // 一意キー列を返金 ID で流用して冪等化する (決済 ID と返金 ID は別空間)
      square_payment_id: r.id,
      sale_kind: (original?.sale_kind as SaleKind | null) ?? null,
      related_member_id: original?.related_member_id ?? null,
    },
    { onConflict: 'square_payment_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: `[refund/${r.id}] ${error.message}` };
  return { ok: true };
}
