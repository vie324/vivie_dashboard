import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// 回数券を会員に発行
export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const {
    member_id,
    plan_id,
    plan_name,
    total_count,
    price,
    validity_months,
    purchased_at,
    store_id,
    notes,
  } = body;

  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

  const supabase = createServiceClient();

  // プラン情報を取得 (snapshot 用)
  let snapshot = {
    plan_name: plan_name as string | null,
    total_count: Number(total_count) || 0,
    price: Number(price) || 0,
    validity_months: Number(validity_months) || 6,
  };

  if (plan_id) {
    const { data: plan } = await supabase
      .from('ticket_plans')
      .select('name, total_count, price, validity_months')
      .eq('id', plan_id)
      .maybeSingle();
    if (plan) {
      snapshot = {
        plan_name: snapshot.plan_name || (plan as any).name,
        total_count: snapshot.total_count || (plan as any).total_count,
        price: snapshot.price || (plan as any).price,
        validity_months: snapshot.validity_months || (plan as any).validity_months,
      };
    }
  }

  if (!snapshot.plan_name || snapshot.total_count <= 0) {
    return NextResponse.json(
      { error: 'plan_id か (plan_name + total_count) が必要です' },
      { status: 400 },
    );
  }

  // 期限計算
  const purchaseDate = purchased_at ? new Date(purchased_at) : new Date();
  const expires = new Date(purchaseDate);
  expires.setMonth(expires.getMonth() + snapshot.validity_months);

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      member_id,
      plan_id: plan_id || null,
      store_id: store_id || null,
      plan_name: snapshot.plan_name,
      total_count: snapshot.total_count,
      price: snapshot.price,
      purchased_at: purchaseDate.toISOString().slice(0, 10),
      expires_at: expires.toISOString().slice(0, 10),
      notes: notes || null,
      sold_by: user.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ticket_id: (data as any).id });
}
