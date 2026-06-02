import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { pushMessage, lineConfigured } from '@/lib/line/client';
import { logAudit } from '@/lib/audit';

// 回数券の失効間近 / 低残数を会員に LINE で通知する
export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!lineConfigured()) {
    return NextResponse.json({ error: 'LINE が未設定です (LINE_CHANNEL_ACCESS_TOKEN)' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { ticket_id } = body;
  if (!ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('ticket_overview')
    .select(
      'id, member_id, member_name, line_user_id, plan_name, remaining_count, expires_at, days_until_expiry',
    )
    .eq('id', ticket_id)
    .maybeSingle();
  const ticket = data as any;
  if (!ticket) return NextResponse.json({ error: 'ticket not found' }, { status: 404 });
  if (!ticket.line_user_id) {
    return NextResponse.json({ error: 'この会員は LINE 未連携です' }, { status: 400 });
  }

  const days = Math.max(0, ticket.days_until_expiry ?? 0);
  const text =
    `${ticket.member_name ?? 'お客様'}様\n\n` +
    `いつもご利用ありがとうございます🌸\n` +
    `ご利用中の回数券についてお知らせです。\n\n` +
    `【${ticket.plan_name}】\n` +
    `残り ${ticket.remaining_count} 回\n` +
    `有効期限: ${ticket.expires_at}（あと ${days} 日）\n\n` +
    `期限内のご利用がお得です。ぜひご予約をお待ちしております✨`;

  const result = await pushMessage(ticket.line_user_id, [{ type: 'text', text }]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  // 送信内容を会話履歴に残す
  await supabase.from('line_messages').insert({
    line_user_id: ticket.line_user_id,
    member_id: ticket.member_id,
    direction: 'outbound',
    message_type: 'text',
    message_text: text,
    sent_by: user.id,
    line_message_id: result.requestId,
  });

  await logAudit(supabase, {
    action: 'ticket.remind',
    entity: 'ticket',
    entityId: ticket_id,
    actorId: user.id,
    details: { remaining: ticket.remaining_count, days_until_expiry: ticket.days_until_expiry },
  });

  return NextResponse.json({ ok: true });
}
