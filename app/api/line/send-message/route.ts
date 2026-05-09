import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { pushMessage, lineConfigured } from '@/lib/line/client';

// ダッシュボードからの自由なテキスト送信
export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!lineConfigured()) {
    return NextResponse.json(
      { error: 'LINE 連携が未設定です' },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { line_user_id, text } = body;
  if (typeof line_user_id !== 'string' || !line_user_id) {
    return NextResponse.json({ error: 'line_user_id required' }, { status: 400 });
  }
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'メッセージが長すぎます (最大 2000 文字)' }, { status: 400 });
  }

  const result = await pushMessage(line_user_id, [
    { type: 'text', text },
  ]);

  const supabase = createServiceClient();

  // 紐付いた会員 id を取得
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('line_user_id', line_user_id)
    .maybeSingle();

  if (!result.ok) {
    await supabase.from('line_messages').insert({
      line_user_id,
      member_id: (member as any)?.id ?? null,
      direction: 'outbound',
      message_type: 'system',
      message_text: `[送信失敗] ${result.error}`,
      sent_by: user.id,
    });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { data: msg, error } = await supabase
    .from('line_messages')
    .insert({
      line_user_id,
      member_id: (member as any)?.id ?? null,
      direction: 'outbound',
      message_type: 'text',
      message_text: text,
      sent_by: user.id,
      line_message_id: result.requestId,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: msg });
}
