import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { AdminConsole } from '@/components/admin/admin-console';
import { todayISO, monthRange } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string; month?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role === 'staff' || staff.role === 'store') redirect('/');

  const supabase = createClient();
  const month = searchParams.month ?? todayISO().slice(0, 7);
  const { start, endExclusive } = monthRange(month);

  const [
    { data: stores },
    { data: allStaff },
    { data: cashbook },
    { data: attendance },
  ] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('staff')
      .select('id, display_name, role, is_active, daily_report_token, primary_store:stores(name)')
      .order('is_active', { ascending: false })
      .order('display_name'),
    supabase
      .from('cashbook_entries')
      .select('*')
      .gte('entry_date', start)
      .lt('entry_date', endExclusive)
      .order('entry_date', { ascending: false })
      .limit(2000),
    supabase
      .from('attendance_logs')
      .select('*, staff:staff(display_name), store:stores(name)')
      .gte('clocked_at', `${start}T00:00:00`)
      .lt('clocked_at', `${endExclusive}T00:00:00`)
      .order('clocked_at', { ascending: false })
      .limit(2000),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="管理コンソール"
        description="出納帳・勤怠の編集、スタッフ専用 URL の発行をまとめて管理できます"
      />
      <AdminConsole
        currentTab={searchParams.tab ?? 'cashbook'}
        month={month}
        stores={(stores ?? []) as any}
        staff={(allStaff ?? []) as any}
        cashbook={(cashbook ?? []) as any}
        attendance={(attendance ?? []) as any}
        canManageStaff={staff.role === 'admin'}
      />
    </div>
  );
}
