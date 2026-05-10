import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { CounselingMapView } from '@/components/counseling/counseling-map';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CounselingMapPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/counseling');

  const supabase = createClient();
  const [
    { data: resolved },
    { count: unresolvedCount },
    { count: untriedCount },
    { count: failedCount },
    { count: addressedTotal },
    { data: unresolvedSamples },
    { data: failedSamples },
  ] = await Promise.all([
    supabase
      .from('counseling_records')
      .select(
        'id, full_name, acquisition_channel, contract_plan, closing_status, geo_lat, geo_lng, address, submitted_at',
      )
      .not('geo_lat', 'is', null)
      .not('geo_lng', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(2000),
    // 未解決 (lat null + 住所あり)
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .is('geo_lat', null)
      .not('address', 'is', null),
    // 未試行 (lat null + 住所あり + 試行履歴なし)
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .is('geo_lat', null)
      .is('geo_attempted_at', null)
      .not('address', 'is', null),
    // 試行済だが失敗 (lat null + 試行履歴あり)
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .is('geo_lat', null)
      .not('geo_attempted_at', 'is', null)
      .not('address', 'is', null),
    // 住所が登録されている全件
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .not('address', 'is', null),
    supabase
      .from('counseling_records')
      .select('id, full_name, address')
      .is('geo_lat', null)
      .is('geo_attempted_at', null)
      .not('address', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(20),
    supabase
      .from('counseling_records')
      .select('id, full_name, address, geo_error, geo_attempted_at')
      .is('geo_lat', null)
      .not('geo_attempted_at', 'is', null)
      .not('address', 'is', null)
      .order('geo_attempted_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Link
        href="/counseling"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        一覧に戻る
      </Link>
      <PageHeader
        title="カウンセリング マップ"
        description="お客様の住所を地図上にマッピング (媒体カラー / 契約有無の塗り分け)"
      />
      <CounselingMapView
        points={(resolved ?? []) as any}
        unresolvedCount={unresolvedCount ?? 0}
        untriedCount={untriedCount ?? 0}
        failedCount={failedCount ?? 0}
        addressedTotal={addressedTotal ?? 0}
        unresolvedSamples={(unresolvedSamples ?? []) as any}
        failedSamples={(failedSamples ?? []) as any}
      />
    </div>
  );
}
