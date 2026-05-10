import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { ReservationForm } from '@/components/reservations/reservation-form';

export const dynamic = 'force-dynamic';

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: { date?: string; time?: string; staff?: string; store?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  const supabase = createClient();
  const [{ data: stores }, { data: staffList }, { data: members }] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase.from('staff').select('id, display_name').eq('is_active', true).order('display_name'),
    supabase.from('members').select('id, full_name, furigana, phone, line_picture_url').order('full_name').limit(2000),
  ]);

  let initial: any = undefined;
  if (searchParams.date || searchParams.time || searchParams.staff || searchParams.store) {
    initial = {};
    if (searchParams.date && searchParams.time) {
      const dt = new Date(`${searchParams.date}T${searchParams.time}`);
      if (!Number.isNaN(dt.getTime())) initial.reservation_at = dt.toISOString();
    }
    if (searchParams.staff) initial.staff_id = searchParams.staff;
    if (searchParams.store) initial.store_id = searchParams.store;
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader title="新規予約" description="電話・直接・SNS DM 等の予約を手動で登録します" />
      <ReservationForm
        stores={(stores ?? []) as any}
        staff={(staffList ?? []) as any}
        members={(members ?? []) as any}
        defaultStoreId={staff.primary_store_id}
        initial={initial}
      />
    </div>
  );
}
