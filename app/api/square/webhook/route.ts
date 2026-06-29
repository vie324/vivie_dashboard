import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { jstDateFromISO } from '@/lib/utils';
import type { SaleKind } from '@/types/database';

// Square Webhook 署名検証
function verifySquareSignature(
  body: string,
  signature: string | null,
  notificationUrl: string,
  signatureKey: string,
): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(notificationUrl + body);
  const expected = hmac.digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const signature = request.headers.get('x-square-hmacsha256-signature');
  const url = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/square/webhook`
    : request.url;

  if (signatureKey && !verifySquareSignature(body, signature, url, signatureKey)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const type = event.type as string;

  try {
    if (type?.startsWith('subscription.')) {
      const sub = event.data?.object?.subscription;
      if (sub) {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('square_customer_id', sub.customer_id)
          .maybeSingle();
        if (member) {
          await supabase.from('member_subscriptions').upsert(
            {
              square_subscription_id: sub.id,
              member_id: member.id,
              status: sub.status ?? 'UNKNOWN',
              started_at: sub.start_date ?? null,
              next_billing_at: sub.charged_through_date ?? null,
              cancelled_at: sub.canceled_date ?? null,
            },
            { onConflict: 'square_subscription_id' },
          );
        }
      }
    } else if (type?.startsWith('customer.')) {
      const c = event.data?.object?.customer;
      if (c) {
        const fullName = [c.family_name, c.given_name].filter(Boolean).join(' ').trim() || c.company_name || '名前未設定';
        await supabase.from('members').upsert(
          {
            square_customer_id: c.id,
            source: 'square' as const,
            full_name: fullName,
            email: c.email_address ?? null,
            phone: c.phone_number ?? null,
          },
          { onConflict: 'square_customer_id' },
        );
      }
    } else if (type?.startsWith('payment.')) {
      const p = event.data?.object?.payment;
      if (p && p.status === 'COMPLETED' && p.amount_money?.amount) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('square_location_id', p.location_id)
          .maybeSingle();
        if (store) {
          const amount = Number(p.amount_money.amount);

          // サブスク課金かどうかを判定する。
          // Square の payment オブジェクトは subscription_id を直接持たないため、
          // 顧客の有効サブスクとその月額が金額一致するかで推定する。
          let saleKind: SaleKind = 'single';
          let matchedSubscriptionId: string | null = null;
          let relatedMemberId: string | null = null;

          if (p.customer_id) {
            const { data: member } = await supabase
              .from('members')
              .select('id')
              .eq('square_customer_id', p.customer_id)
              .maybeSingle();
            relatedMemberId = (member as any)?.id ?? null;

            if (relatedMemberId) {
              const { data: subs } = await supabase
                .from('member_subscriptions')
                .select('square_subscription_id, status, plan:subscription_plans(monthly_price)')
                .eq('member_id', relatedMemberId)
                .in('status', ['ACTIVE', 'active']);
              const match = (subs ?? []).find(
                (s: any) => Number(s.plan?.monthly_price ?? -1) === amount,
              );
              if (match) {
                saleKind = 'subscription';
                matchedSubscriptionId = (match as any).square_subscription_id ?? null;
              }
            }
          }

          // square_payment_id の一意制約により再送・payment.created/updated の二重計上を防止
          await supabase.from('cashbook_entries').upsert(
            {
              store_id: store.id,
              entry_date: jstDateFromISO(p.created_at),
              entry_type: 'income' as const,
              source: 'square' as const,
              category: saleKind === 'subscription' ? 'サブスク売上' : 'Square 決済',
              amount,
              description: `Square Payment ${p.id}`,
              square_payment_id: p.id,
              square_order_id: p.order_id ?? null,
              square_subscription_id: matchedSubscriptionId,
              sale_kind: saleKind,
              related_member_id: relatedMemberId,
            },
            { onConflict: 'square_payment_id', ignoreDuplicates: false },
          );
        }
      }
    }
  } catch (err) {
    console.error('webhook error', err);
  }

  return NextResponse.json({ ok: true });
}
