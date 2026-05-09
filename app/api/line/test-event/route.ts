import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// ローカルで Webhook ハンドラの動作を確認するためのテスト送信
// 認証ユーザーのみ。実 LINE は経由せずに line_messages にダミーレコードを作る
export async function POST() {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const fakeUserId = `test_user_${Date.now()}`;
  const now = new Date().toISOString();

  await supabase.from('line_events').insert({
    event_type: 'message',
    line_user_id: fakeUserId,
    display_name: 'テストユーザー',
    message_text: '(テスト送信) これは診断ボタンから挿入されたサンプルです',
    raw: { test: true },
  });

  await supabase.from('line_messages').insert({
    line_user_id: fakeUserId,
    direction: 'inbound',
    message_type: 'text',
    message_text: '(テスト送信) これは診断ボタンから挿入されたサンプルです',
    sent_at: now,
  });

  return NextResponse.json({
    ok: true,
    note: '/messages 一覧と LINE 診断画面の直近イベントに "テストユーザー" が出れば DB 書き込みは正常です',
  });
}
