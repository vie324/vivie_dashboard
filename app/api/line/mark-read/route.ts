import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 会話の未読を既読にする
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { line_user_id } = body;
  if (!line_user_id) return NextResponse.json({ error: 'line_user_id required' }, { status: 400 });

  const { error } = await supabase
    .from('line_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('line_user_id', line_user_id)
    .eq('direction', 'inbound')
    .is('read_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
