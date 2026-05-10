import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dispatchEmail } from '@/lib/gmail/parsers';

// 開発用: メール本文を貼り付けてパース結果を確認
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { sender = '', subject = '', body: text = '' } = body;
  const result = dispatchEmail(sender, subject, text);
  return NextResponse.json({ ok: true, ...result });
}
