import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { ReservationImportForm } from '@/components/reservations/reservation-import-form';

export const dynamic = 'force-dynamic';

export default async function ReservationImportPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/reservations');

  const supabase = createClient();
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <PageHeader
        title="予約 CSV インポート"
        description="HPB / minimo / 自由フォーマットの CSV を取り込みます (重複は自動マージ)"
      />
      <ReservationImportForm stores={(stores ?? []) as any} />
    </div>
  );
}
