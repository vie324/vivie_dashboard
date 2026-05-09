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

  console.log('[LINE webhook] received', {
    hasSignature: !!signature,
    bodyLength: body.length,
    secretSet: !!secret,
  });

  // 署名検証 (secret が設定されている時のみ)
  if (secret) {
    const ok = verifySignature(body, signature, secret);
    if (!ok) {
      console.error('[LINE webhook] signature verification failed');
      // 署名失敗時もイベントは記録 (デバッグ用)
      try {
        const supabase = createServiceClient();
        await supabase.from('line_events').insert({
          event_type: 'signature_failed',
          raw: { body: body.slice(0, 1000), signature },
        });
      } catch {}
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    console.error('[LINE webhook] invalid json', err);
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const events = payload.events ?? [];
  console.log('[LINE webhook] events count:', events.length);

  const supabase = createServiceClient();
  let saved = 0;
  let errored = 0;

  for (const event of events) {
    try {
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

      // 紐付き会員を検索
      let memberId: string | null = null;
      if (userId) {
        const { data: existing } = await supabase
          .from('members')
          .select('id, line_display_name')
          .eq('line_user_id', userId)
          .maybeSingle();
        memberId = (existing as any)?.id ?? null;

        if (memberId && displayName && (event.type === 'follow' || event.type === 'message')) {
          await supabase
            .from('members')
            .update({ line_display_name: displayName, line_picture_url: pictureUrl })
            .eq('id', memberId);
        }
      }

      // 1) イベントログ
      const { error: evErr } = await supabase.from('line_events').insert({
        event_type: event.type,
        line_user_id: userId ?? null,
        display_name: displayName,
        picture_url: pictureUrl,
        message_text: event.message?.text ?? null,
        raw: event,
        member_id: memberId,
      });
      if (evErr) console.error('[LINE webhook] event insert error', evErr);

      // 2) message イベントは line_messages にも保存
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
                  : msgType === 'audio'
                    ? '(音声)'
                    : msgType === 'file'
                      ? `(ファイル: ${event.message?.fileName ?? ''})`
                      : `(${msgType})`;
        const { error: msgErr } = await supabase.from('line_messages').insert({
          line_user_id: userId,
          member_id: memberId,
          direction: 'inbound',
          message_type: msgType,
          message_text: text,
          content: event.message ?? null,
          line_message_id: event.message?.id ?? null,
          sent_at: event.timestamp
            ? new Date(event.timestamp).toISOString()
            : new Date().toISOString(),
        });
        if (msgErr) {
          console.error('[LINE webhook] message insert error', msgErr);
          errored++;
        } else {
          saved++;
        }
      }

      // 3) follow / unfollow イベントもチャットに残す
      if ((event.type === 'follow' || event.type === 'unfollow') && userId) {
        await supabase.from('line_messages').insert({
          line_user_id: userId,
          member_id: memberId,
          direction: 'inbound',
          message_type: 'system',
          message_text: event.type === 'follow' ? '友だちに追加されました' : 'ブロックされました',
          content: { event_type: event.type },
          sent_at: event.timestamp
            ? new Date(event.timestamp).toISOString()
            : new Date().toISOString(),
        });
      }
    } catch (err) {
      errored++;
      console.error('[LINE webhook] event handler error', err);
    }
  }

  console.log('[LINE webhook] done', { saved, errored });

  return NextResponse.json({ ok: true, saved, errored });
}

// LINE Developers の Verify ボタン用 (HEAD/GET)
export async function GET() {
  return NextResponse.json({ ok: true });
}
