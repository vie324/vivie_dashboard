import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { GmailClient, extractTextBody, getHeader } from '@/lib/gmail/client';
import { dispatchEmail } from '@/lib/gmail/parsers';

// Cloud Pub/Sub の Push 配信を受信
// 認証はサービスアカウントの OIDC トークン or 共有シークレット (Pub/Sub の attributes に追加)
// シンプル運用のため、URL に ?token=XXX を付けて検証する方式を採用
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const expected = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
  if (expected && token !== expected) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Pub/Sub Push 形式: { message: { data: base64, messageId, publishTime }, subscription }
  const msgB64 = payload?.message?.data;
  if (!msgB64) {
    // Pub/Sub の health check など
    return NextResponse.json({ ok: true });
  }

  let pubsubData: { emailAddress: string; historyId: string | number };
  try {
    pubsubData = JSON.parse(Buffer.from(msgB64, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.json({ error: 'invalid pubsub data' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from('gmail_integration_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (!settings || !(settings as any).refresh_token) {
    console.error('[gmail webhook] settings not configured');
    return NextResponse.json({ ok: true });
  }
  if ((settings as any).email_address && (settings as any).email_address !== pubsubData.emailAddress) {
    console.warn('[gmail webhook] mismatched email', pubsubData.emailAddress);
  }

  const startHistoryId =
    (settings as any).history_id ?? String(pubsubData.historyId);

  let messageIds: string[] = [];
  const client = new GmailClient((settings as any).refresh_token);
  try {
    messageIds = await client.historyList(startHistoryId);
  } catch (err) {
    console.error('[gmail webhook] history fail', err);
    await supabase
      .from('gmail_integration_settings')
      .update({ last_error: String(err).slice(0, 500) })
      .eq('id', 'default');
    return NextResponse.json({ error: 'history failed' }, { status: 200 });
  }

  let processed = 0;
  let parsed = 0;

  for (const messageId of messageIds) {
    try {
      // 既処理ならスキップ
      const { data: existing } = await supabase
        .from('inbound_emails')
        .select('id')
        .eq('message_id', messageId)
        .maybeSingle();
      if (existing) continue;

      const message = await client.getMessage(messageId);
      const subject = getHeader(message.payload, 'Subject') ?? '';
      const from = getHeader(message.payload, 'From') ?? '';
      const body = extractTextBody(message.payload);

      const { parsed: parsedReservation, parser } = dispatchEmail(from, subject, body);

      const { data: emailRow } = await supabase
        .from('inbound_emails')
        .insert({
          message_id: messageId,
          thread_id: message.threadId,
          sender: from,
          subject,
          received_at: message.internalDate
            ? new Date(parseInt(message.internalDate, 10)).toISOString()
            : new Date().toISOString(),
          body_snippet: message.snippet ?? null,
          body_text: body.slice(0, 8000),
          parser_used: parser,
          parsed_data: parsedReservation as any,
          status: parsedReservation ? 'parsed' : 'unmatched',
        })
        .select('id')
        .single();

      processed++;

      if (parsedReservation) {
        // store_id は最初の店舗を採用 (今後設定で選べるように)
        const { data: defaultStore } = await supabase
          .from('stores')
          .select('id')
          .eq('is_active', true)
          .order('name')
          .limit(1)
          .maybeSingle();
        const storeId = (defaultStore as any)?.id;
        if (storeId) {
          const { data: insertedRes, error: insertErr } = await supabase
            .from('reservations')
            .upsert(
              {
                customer_name: parsedReservation.customer_name,
                customer_furigana: parsedReservation.customer_furigana,
                customer_phone: parsedReservation.customer_phone,
                customer_email: parsedReservation.customer_email,
                source: parsedReservation.source,
                external_id: parsedReservation.external_id,
                reservation_at: parsedReservation.reservation_at,
                duration_minutes: parsedReservation.duration_minutes,
                menu: parsedReservation.menu,
                amount: parsedReservation.amount,
                status: parsedReservation.status,
                notes: parsedReservation.notes,
                store_id: storeId,
                source_data: { email_message_id: messageId, sender: from },
              },
              { onConflict: 'source,external_id', ignoreDuplicates: false },
            )
            .select('id')
            .maybeSingle();

          if (insertErr) {
            await supabase
              .from('inbound_emails')
              .update({
                status: 'error',
                error_message: insertErr.message,
              })
              .eq('id', (emailRow as any).id);
          } else if (insertedRes) {
            await supabase
              .from('inbound_emails')
              .update({
                status: 'matched',
                reservation_id: (insertedRes as any).id,
              })
              .eq('id', (emailRow as any).id);
            parsed++;
          }
        }
      }
    } catch (err) {
      console.error('[gmail webhook] message process fail', messageId, err);
    }
  }

  // history_id 更新 + last_received_at
  await supabase
    .from('gmail_integration_settings')
    .update({
      history_id: String(pubsubData.historyId),
      last_received_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', 'default');

  console.log('[gmail webhook] processed', processed, 'parsed', parsed);
  return NextResponse.json({ ok: true, processed, parsed });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
