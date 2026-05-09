import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { DailyReportForm } from '@/components/reports/daily-report-form';

export default async function NewReportPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  const supabase = createClient();
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader title="日報を入力" description="今日の集客・施術・売上を記録します" />
      <DailyReportForm
        stores={stores ?? []}
        staffId={staff.id}
        staffName={staff.display_name}
        defaultStoreId={staff.primary_store_id}
      />
    </div>
  );
}
