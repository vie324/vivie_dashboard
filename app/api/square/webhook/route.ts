import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { describeSquareError, squareClient } from '@/lib/square/client';
import { recordPayment, recordRefund } from '@/lib/square/payments';
import { joinJaName } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Square Webhook 署名検証 (HMAC-SHA256 over notificationUrl + rawBody, base64)
function verifySquareSignature(
  body: string,
  signature: string | null,
  notificationUrl: string,
  signatureKey: string,
): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(notificationUrl + body);
  const expected = Buffer.from(hmac.digest('base64'));
  const provided = Buffer.from(signature);
  // timingSafeEqual は長さ不一致で throw するため事前にガードする
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

function notificationUrl(request: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  return base ? `${base}/api/square/webhook` : request.url;
}

// サブスクイベントの upsert。会員が未同期なら Square から顧客を取得して先に作成する。
async function upsertSubscriptionFromEvent(
  supabase: ReturnType<typeof createServiceClient>,
  sub: any,
): Promise<{ error: string | null }> {
  if (!sub?.id || !sub?.customer_id) return { error: null };

  let { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('square_customer_id', sub.customer_id)
    .maybeSingle();

  // Webhook はイベント順序が保証されないため、customer.created より先に
  // subscription.* が届くことがある。その場で Square から顧客を引いて作成する。
  if (!member) {
    try {
      const res = await squareClient().customersApi.retrieveCustomer(sub.customer_id);
      const c = res.result.customer;
      if (c?.id) {
        const { data: created, error: createErr } = await supabase
          .from('members')
          .upsert(
            {
              square_customer_id: c.id,
              source: 'square' as const,
              full_name: joinJaName(c.familyName, c.givenName, c.companyName),
              email: c.emailAddress ?? null,
              phone: c.phoneNumber ?? null,
              status: 'active' as const,
            },
            { onConflict: 'square_customer_id' },
          )
          .select('id')
          .maybeSingle();
        if (createErr) return { error: createErr.message };
        member = created;
      }
    } catch (err) {
      console.error('webhook: retrieveCustomer failed', describeSquareError(err, 'sub'));
    }
  }
  if (!member) return { error: `member not found for customer ${sub.customer_id}` };

  // プラン (variation) を引いて plan_id も紐付ける
  let planRowId: string | null = null;
  const planVariationId = sub.plan_variation_id ?? sub.plan_id ?? null;
  if (planVariationId) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('square_plan_id', planVariationId)
      .maybeSingle();
    planRowId = (plan as any)?.id ?? null;
  }

  const { error } = await supabase.from('member_subscriptions').upsert(
    {
      square_subscription_id: sub.id,
      member_id: (member as any).id,
      ...(planRowId ? { plan_id: planRowId } : {}),
      status: sub.status ?? 'UNKNOWN',
      started_at: sub.start_date ?? null,
      next_billing_at: sub.charged_through_date ?? null,
      cancelled_at: sub.canceled_date ?? null,
    },
    { onConflict: 'square_subscription_id' },
  );
  return { error: error?.message ?? null };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const signature = request.headers.get('x-square-hmacsha256-signature');

  // 署名キー未設定はフェイルクローズ (誰でも売上・会員データを注入できてしまうため)
  if (!signatureKey) {
    console.error('SQUARE_WEBHOOK_SIGNATURE_KEY is not set — rejecting webhook');
    return NextResponse.json({ error: 'webhook signature key not configured' }, { status: 503 });
  }
  if (!verifySquareSignature(body, signature, notificationUrl(request), signatureKey)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const type = (event.type ?? '') as string;
  // DB 書き込みが失敗したら 500 を返して Square に再送させる (以前は握り潰して 200 を
  // 返しており、売上の取りこぼしが静かに起きていた)
  const failures: string[] = [];

  try {
    if (type.startsWith('subscription.')) {
      const sub = event.data?.object?.subscription;
      if (sub) {
        const { error } = await upsertSubscriptionFromEvent(supabase, sub);
        if (error) failures.push(`[subscription/${sub.id}] ${error}`);
      }
    } else if (type === 'customer.deleted') {
      // 削除イベントで upsert すると会員が復活してしまうため何もしない
      // (紐付く来店・売上履歴を保持するため行削除もしない)
    } else if (type.startsWith('customer.')) {
      const c = event.data?.object?.customer;
      if (c?.id) {
        const { error } = await supabase.from('members').upsert(
          {
            square_customer_id: c.id,
            source: 'square' as const,
            full_name: joinJaName(c.family_name, c.given_name, c.company_name),
            email: c.email_address ?? null,
            phone: c.phone_number ?? null,
          },
          { onConflict: 'square_customer_id' },
        );
        if (error) failures.push(`[customer/${c.id}] ${error.message}`);
      }
    } else if (type.startsWith('payment.')) {
      const p = event.data?.object?.payment;
      if (p?.id) {
        const result = await recordPayment(supabase, {
          id: p.id,
          status: p.status ?? null,
          amount: Number(p.total_money?.amount ?? p.amount_money?.amount ?? 0),
          locationId: p.location_id ?? null,
          customerId: p.customer_id ?? null,
          orderId: p.order_id ?? null,
          createdAt: p.created_at ?? null,
        });
        if (!result.ok) failures.push(result.error);
      }
    } else if (type.startsWith('refund.')) {
      const r = event.data?.object?.refund;
      if (r?.id) {
        const result = await recordRefund(supabase, {
          id: r.id,
          status: r.status ?? null,
          amount: Number(r.amount_money?.amount ?? 0),
          locationId: r.location_id ?? null,
          paymentId: r.payment_id ?? null,
          createdAt: r.created_at ?? null,
        });
        if (!result.ok) failures.push(result.error);
      }
    }
  } catch (err) {
    console.error('webhook error', err);
    failures.push(err instanceof Error ? err.message : 'unknown error');
  }

  if (failures.length > 0) {
    // 詳細はサーバーログのみに残す (レスポンスは Square のダッシュボードに表示されるため
    // DB エラー文字列や内部 ID を含めない)。5xx を返せば Square が再送する。
    console.error('webhook failures', failures);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
