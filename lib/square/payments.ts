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

// DB エラーは「該当なし」と区別して呼び出し元へ返す。エラーを null 扱いすると
// 一時的な障害が「店舗未設定」として 200 ACK され、Square が再送しなくなる。
async function storeIdForLocation(
  supabase: SupabaseClient<any>,
  locationId: string | null,
): Promise<{ id: string | null; error: string | null }> {
  if (!locationId) return { id: null, error: null };
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .eq('square_location_id', locationId)
    .maybeSingle();
  if (error) return { id: null, error: error.message };
  return { id: (data as any)?.id ?? null, error: null };
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
  const store = await storeIdForLocation(supabase, p.locationId);
  if (store.error) return { ok: false, error: `[payment/${p.id}] ${store.error}` };
  if (!store.id) {
    return { ok: true, skipped: `store_unmapped:${p.locationId ?? 'unknown'}` };
  }
  const storeId = store.id;

  // サブスク課金かどうかを判定する。Square の payment は subscription_id を直接
  // 持たないため、顧客の有効サブスクの月額と金額一致するかで推定する。
  let saleKind: SaleKind = 'single';
  let matchedSubscriptionId: string | null = null;
  let relatedMemberId: string | null = null;

  if (p.customerId) {
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id')
      .eq('square_customer_id', p.customerId)
      .maybeSingle();
    // 判定用ルックアップの失敗を無視すると sale_kind が誤分類のまま固定される
    // (ignoreDuplicates で後から直らない) ため、エラーとして返して再送させる
    if (memberErr) return { ok: false, error: `[payment/${p.id}] ${memberErr.message}` };
    relatedMemberId = (member as any)?.id ?? null;

    if (relatedMemberId) {
      const { data: subs, error: subsErr } = await supabase
        .from('member_subscriptions')
        .select('square_subscription_id, status, plan:subscription_plans(monthly_price)')
        .eq('member_id', relatedMemberId)
        .in('status', ['ACTIVE', 'active']);
      if (subsErr) return { ok: false, error: `[payment/${p.id}] ${subsErr.message}` };
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
    const { data, error } = await supabase
      .from('cashbook_entries')
      .select('store_id, sale_kind, related_member_id')
      .eq('square_payment_id', r.paymentId)
      .maybeSingle();
    if (error) return { ok: false, error: `[refund/${r.id}] ${error.message}` };
    original = data;
  }

  let storeId: string | null = original?.store_id ?? null;
  if (!storeId) {
    const store = await storeIdForLocation(supabase, r.locationId);
    if (store.error) return { ok: false, error: `[refund/${r.id}] ${store.error}` };
    storeId = store.id;
  }
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
