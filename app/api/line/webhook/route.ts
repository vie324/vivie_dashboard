import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/line/client';

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const expected = hmac.digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const secret = process.env.LINE_CHANNEL_SECRET;
  const signature = request.headers.get('x-line-signature');

  if (secret && !verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const supabase = createServiceClient();

  for (const event of payload.events ?? []) {
    const userId: string | undefined = event.source?.userId;
    let displayName: string | null = null;
    let pictureUrl: string | null = null;

    if (userId) {
      const profile = await getProfile(userId);
      if (profile) {
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl ?? null;
      }
    }

    // 既存会員にひも付け試行 (line_user_id が一致する場合)
    let memberId: string | null = null;
    if (userId) {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('line_user_id', userId)
        .maybeSingle();
      memberId = (existing as any)?.id ?? null;
    }

    await supabase.from('line_events').insert({
      event_type: event.type,
      line_user_id: userId ?? null,
      display_name: displayName,
      picture_url: pictureUrl,
      message_text: event.message?.text ?? null,
      raw: event,
      member_id: memberId,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // LINE の Webhook URL 検証用
  return NextResponse.json({ ok: true });
}
