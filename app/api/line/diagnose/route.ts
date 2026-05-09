import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// LINE 設定状況と直近の Webhook イベントを返す。
// 「メッセージが届かない」「会話一覧に出ない」のトラブルシュートに使用。
export async function GET() {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tokenSet = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secretSet = !!process.env.LINE_CHANNEL_SECRET;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/line/webhook`;

  // 1) Channel Access Token の有効性チェック + Bot 情報取得
  let tokenValid: boolean | null = null;
  let tokenError: string | null = null;
  let botInfo: { userId?: string; basicId?: string; displayName?: string; premiumId?: string; pictureUrl?: string } | null = null;
  if (tokenSet) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/info', {
        headers: { authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      });
      tokenValid = res.ok;
      if (res.ok) {
        botInfo = await res.json();
      } else {
        tokenError = await res.text();
      }
    } catch (err) {
      tokenValid = false;
      tokenError = err instanceof Error ? err.message : 'unknown';
    }
  }

  // 1b) LINE 側に登録されている Webhook URL (Channel に紐付くもの) を取得
  let registeredWebhookUrl: string | null = null;
  let webhookEnabled: boolean | null = null;
  let webhookFetchError: string | null = null;
  if (tokenSet) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        headers: { authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      });
      if (res.ok) {
        const data = await res.json();
        registeredWebhookUrl = data.endpoint ?? null;
        webhookEnabled = data.active ?? null;
      } else {
        webhookFetchError = `${res.status} ${await res.text()}`;
      }
    } catch (err) {
      webhookFetchError = err instanceof Error ? err.message : 'unknown';
    }
  }

  // 1c) Webhook URL が外部から到達可能か検証 (自分宛に GET)
  let urlReachable: boolean | null = null;
  let urlReachableError: string | null = null;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const res = await fetch(webhookUrl, { method: 'GET', cache: 'no-store' });
      urlReachable = res.ok;
      if (!res.ok) urlReachableError = `HTTP ${res.status}`;
    } catch (err) {
      urlReachable = false;
      urlReachableError = err instanceof Error ? err.message : 'unknown';
    }
  }

  // 2) 直近の line_events / line_messages を確認
  const supabase = createServiceClient();
  const [{ data: recentEvents, count: eventCount }, { data: recentMessages, count: messageCount }, { data: inboundCount }] =
    await Promise.all([
      supabase
        .from('line_events')
        .select('id, event_type, line_user_id, display_name, message_text, received_at', {
          count: 'exact',
        })
        .order('received_at', { ascending: false })
        .limit(10),
      supabase
        .from('line_messages')
        .select('id, direction, message_text, sent_at, line_user_id', { count: 'exact' })
        .order('sent_at', { ascending: false })
        .limit(10),
      supabase
        .from('line_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound'),
    ]);

  return NextResponse.json({
    config: {
      access_token_set: tokenSet,
      access_token_valid: tokenValid,
      access_token_error: tokenError,
      channel_secret_set: secretSet,
      webhook_url: webhookUrl,
      app_url: process.env.NEXT_PUBLIC_APP_URL ?? '(NEXT_PUBLIC_APP_URL 未設定)',
      url_reachable: urlReachable,
      url_reachable_error: urlReachableError,
    },
    bot_info: botInfo,
    line_webhook: {
      registered_url: registeredWebhookUrl,
      enabled: webhookEnabled,
      url_matches: registeredWebhookUrl === webhookUrl,
      fetch_error: webhookFetchError,
    },
    counts: {
      total_events: eventCount ?? 0,
      total_messages: messageCount ?? 0,
      inbound_messages: (inboundCount as any)?.count ?? 0,
    },
    recent_events: recentEvents ?? [],
    recent_messages: recentMessages ?? [],
  });
}
