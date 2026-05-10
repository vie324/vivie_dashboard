import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { GmailClient } from '@/lib/gmail/client';

// Gmail watch を開始/更新する
// - 管理画面の POST から手動実行
// - Vercel Cron (GET ?cron=1) で 6 日に 1 回自動更新 (watch は最大 7 日で失効)
async function handle(request: NextRequest) {
  const url = new URL(request.url);
  const isCron =
    url.searchParams.get('cron') === '1' &&
    (request.headers.get('x-vercel-cron') === '1' ||
      (request.headers.get('user-agent') ?? '').includes('vercel-cron'));

  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user && !isCron) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  if (user && !isCron) {
    const { data: actor } = await supabase
      .from('staff')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = (actor as any)?.role;
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const { data: settings } = await supabase
    .from('gmail_integration_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (!settings || !(settings as any).refresh_token) {
    return NextResponse.json({ error: 'Gmail 連携が未完了です' }, { status: 400 });
  }

  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topic) {
    return NextResponse.json(
      { error: 'GMAIL_PUBSUB_TOPIC (例: projects/xxx/topics/gmail-vivie) が未設定です' },
      { status: 500 },
    );
  }

  try {
    const client = new GmailClient((settings as any).refresh_token);
    const watch = await client.watch(topic);
    await supabase
      .from('gmail_integration_settings')
      .update({
        is_active: true,
        history_id: watch.historyId,
        watch_expiration: new Date(Number(watch.expiration)).toISOString(),
        last_error: null,
      })
      .eq('id', 'default');
    return NextResponse.json({ ok: true, ...watch });
  } catch (err) {
    const msg = String(err).slice(0, 500);
    await supabase.from('gmail_integration_settings').update({ last_error: msg }).eq('id', 'default');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
