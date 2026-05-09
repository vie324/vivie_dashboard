import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { StoreSettings } from '@/components/settings/store-settings';
import { StaffSettings } from '@/components/settings/staff-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role === 'staff') redirect('/');

  const supabase = createClient();
  const [{ data: stores }, { data: allStaff }] = await Promise.all([
    supabase.from('stores').select('*').order('name'),
    supabase
      .from('staff')
      .select('*, primary_store:stores(name)')
      .order('display_name'),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="設定" description="店舗・スタッフ・連携の管理を行います" />

      <Card>
        <CardHeader>
          <CardTitle>店舗</CardTitle>
          <p className="mt-1 text-xs text-ink-500">
            GPS 打刻のため、住所と座標を登録してください。許容範囲は半径(m)で指定します。
          </p>
        </CardHeader>
        <CardContent>
          <StoreSettings stores={(stores ?? []) as any} canEdit={staff.role === 'admin'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スタッフ</CardTitle>
          <p className="mt-1 text-xs text-ink-500">
            スタッフを Supabase Auth に登録した後、このページから役割と所属を設定してください。
          </p>
        </CardHeader>
        <CardContent>
          <StaffSettings staff={(allStaff ?? []) as any} stores={(stores ?? []) as any} canEdit={staff.role === 'admin'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>外部連携</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Supabase URL" value={process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ 設定済' : '未設定'} />
          <Row
            label="Square API"
            value={process.env.SQUARE_ACCESS_TOKEN ? '✓ 設定済' : '未設定 (環境変数 SQUARE_ACCESS_TOKEN)'}
          />
          <Row
            label="Square Location IDs"
            value={process.env.SQUARE_LOCATION_IDS ?? '未設定 (環境変数 SQUARE_LOCATION_IDS)'}
          />
          <Row
            label="Webhook URL"
            value={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/square/webhook`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2.5">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-sm text-ink-900 font-mono truncate ml-3">{value}</span>
    </div>
  );
}
