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
        .select('id, line_display_name')
        .eq('line_user_id', userId)
        .maybeSingle();
      memberId = (existing as any)?.id ?? null;

      // friend イベントなら表示名を上書き保存
      if (memberId && (event.type === 'follow' || event.type === 'message')) {
        if (displayName) {
          await supabase
            .from('members')
            .update({ line_display_name: displayName, line_picture_url: pictureUrl })
            .eq('id', memberId);
        }
      }
    }

    // 1) イベントログ
    await supabase.from('line_events').insert({
      event_type: event.type,
      line_user_id: userId ?? null,
      display_name: displayName,
      picture_url: pictureUrl,
      message_text: event.message?.text ?? null,
      raw: event,
      member_id: memberId,
    });

    // 2) message イベントの場合はチャット履歴 (line_messages) にも保存
    if (event.type === 'message' && userId) {
      const msgType = event.message?.type ?? 'text';
      const text =
        msgType === 'text'
          ? event.message?.text ?? null
          : msgType === 'sticker'
            ? '(スタンプ)'
            : msgType === 'image'
              ? '(画像)'
              : msgType === 'video'
                ? '(動画)'
                : `(${msgType})`;
      await supabase.from('line_messages').insert({
        line_user_id: userId,
        member_id: memberId,
        direction: 'inbound',
        message_type: msgType,
        message_text: text,
        content: event.message ?? null,
        line_message_id: event.message?.id ?? null,
        sent_at: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
      });
    }

    // 3) follow / unfollow イベントは会話のヘッダー用にシステムメッセージとして残す
    if ((event.type === 'follow' || event.type === 'unfollow') && userId) {
      await supabase.from('line_messages').insert({
        line_user_id: userId,
        member_id: memberId,
        direction: 'inbound',
        message_type: 'system',
        message_text: event.type === 'follow' ? '友だちに追加されました' : 'ブロックされました',
        content: { event_type: event.type },
        sent_at: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // LINE の Webhook URL 検証用
  return NextResponse.json({ ok: true });
}
