import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// 回数券を返金 (ステータスを refunded に)
export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from('staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = (actor as any)?.role;
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { ticket_id, reason } = body;
  if (!ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });

  // 返金額・店舗を控えておく (出納帳に返金支出を記帳するため)
  const { data: ticket } = await supabase
    .from('tickets')
    .select('member_id, store_id, plan_name, price, status')
    .eq('id', ticket_id)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'ticket not found' }, { status: 404 });
  if ((ticket as any).status === 'refunded') {
    return NextResponse.json({ error: 'すでに返金済みです' }, { status: 400 });
  }

  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refunded_by: user.id,
      refund_reason: reason || null,
    })
    .eq('id', ticket_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 売上の取り消しとして返金額を支出計上 (Square / 現金いずれの初期計上も相殺される)
  const t = ticket as any;
  let cashbook_recorded = false;
  if (t.store_id && t.price > 0) {
    const { error: cashErr } = await supabase.from('cashbook_entries').insert({
      store_id: t.store_id,
      entry_date: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
      entry_type: 'expense' as const,
      source: 'other' as const,
      category: '回数券返金',
      amount: t.price,
      description: `回数券返金: ${t.plan_name}${reason ? ` (${reason})` : ''}`,
      related_member_id: t.member_id,
      sale_kind: 'ticket' as const,
      recorded_by: user.id,
    });
    if (!cashErr) cashbook_recorded = true;
  }

  return NextResponse.json({ ok: true, cashbook_recorded });
}
