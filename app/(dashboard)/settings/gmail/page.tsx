import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { GmailSettingsView } from '@/components/settings/gmail-settings-view';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GmailSettingsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/settings');

  const supabase = createClient();
  const [{ data: settings }, { data: emails }] = await Promise.all([
    supabase
      .from('gmail_integration_settings')
      .select('*, connected_staff:staff(display_name)')
      .eq('id', 'default')
      .maybeSingle(),
    supabase
      .from('inbound_emails')
      .select('*, reservation:reservations(id, customer_name)')
      .order('received_at', { ascending: false })
      .limit(30),
  ]);

  const config = {
    oauth_client_set: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    pubsub_topic_set: !!process.env.GMAIL_PUBSUB_TOPIC,
    pubsub_token_set: !!process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN,
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
    pubsub_topic: process.env.GMAIL_PUBSUB_TOPIC ?? null,
  };

  return (
    <div className="space-y-6 animate-fade-in-up max-w-4xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        設定に戻る
      </Link>
      <PageHeader
        title="Gmail 連携 (予約自動取り込み)"
        description="HPB / minimo の通知メールを Gmail 経由で自動取り込みします"
      />
      <GmailSettingsView
        settings={settings as any}
        emails={(emails ?? []) as any}
        config={config}
      />
    </div>
  );
}
