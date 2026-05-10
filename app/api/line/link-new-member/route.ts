import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// LINE 会話を新規会員として登録 + 紐付け
// 既存会員の場合は紐付けのみ
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

  const { line_user_id, full_name, furigana, phone, email, store_id } = body;
  if (!line_user_id || !full_name) {
    return NextResponse.json({ error: 'line_user_id と full_name は必須です' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 既に line_user_id が紐付いている会員がいれば再利用
  const { data: existing } = await supabase
    .from('members')
    .select('id, full_name')
    .eq('line_user_id', line_user_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, member_id: (existing as any).id, reused: true });
  }

  // line_events から最新の display_name / picture_url
  const { data: latestEvent } = await supabase
    .from('line_events')
    .select('display_name, picture_url')
    .eq('line_user_id', line_user_id)
    .not('display_name', 'is', null)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 会員作成
  const { data: created, error } = await supabase
    .from('members')
    .insert({
      full_name,
      furigana: furigana || null,
      phone: phone || null,
      email: email || null,
      source: 'manual',
      status: 'active',
      primary_store_id: store_id || null,
      line_user_id,
      line_display_name: (latestEvent as any)?.display_name ?? null,
      line_picture_url: (latestEvent as any)?.picture_url ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const memberId = (created as any).id;

  // 過去の line_events / line_messages にも member_id を紐付け
  await supabase
    .from('line_events')
    .update({ member_id: memberId })
    .eq('line_user_id', line_user_id)
    .is('member_id', null);
  await supabase
    .from('line_messages')
    .update({ member_id: memberId })
    .eq('line_user_id', line_user_id)
    .is('member_id', null);

  return NextResponse.json({ ok: true, member_id: memberId, reused: false });
}
