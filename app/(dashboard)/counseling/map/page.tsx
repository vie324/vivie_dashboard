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
  const [{ data: resolved }, { count: unresolvedCount }] = await Promise.all([
    supabase
      .from('counseling_records')
      .select(
        'id, full_name, acquisition_channel, contract_plan, closing_status, geo_lat, geo_lng, address, submitted_at',
      )
      .not('geo_lat', 'is', null)
      .not('geo_lng', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(2000),
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .is('geo_lat', null)
      .not('address', 'is', null),
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
      />
    </div>
  );
}
