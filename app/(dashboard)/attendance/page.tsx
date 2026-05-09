import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { AttendancePanel } from '@/components/attendance/attendance-panel';
import { AttendanceSummary } from '@/components/attendance/attendance-summary';
import { todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const supabase = createClient();
  const isManager = staff.role === 'admin' || staff.role === 'manager';
  const monthStart = todayISO().slice(0, 7) + '-01';

  const [{ data: stores }, { data: recentLogs }, { data: dailyAll }, { data: allStaff }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name, latitude, longitude, radius_meters')
      .eq('is_active', true)
      .order('name'),
    isManager
      ? supabase
          .from('attendance_logs')
          .select('*, staff:staff(display_name), store:stores(name)')
          .order('clocked_at', { ascending: false })
          .limit(80)
      : supabase
          .from('attendance_logs')
          .select('*, staff:staff(display_name), store:stores(name)')
          .eq('staff_id', staff.id)
          .order('clocked_at', { ascending: false })
          .limit(80),
    isManager
      ? supabase.from('attendance_daily').select('*').gte('work_date', monthStart)
      : supabase
          .from('attendance_daily')
          .select('*')
          .eq('staff_id', staff.id)
          .gte('work_date', monthStart),
    supabase.from('staff').select('id, display_name'),
  ]);

  const staffMap = new Map<string, string>();
  (allStaff ?? []).forEach((s: any) => staffMap.set(s.id, s.display_name));
  const storeMap = new Map<string, string>();
  (stores ?? []).forEach((s: any) => storeMap.set(s.id, s.name));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="勤怠管理"
        description="店舗の半径内で打刻 (GPS 認証)。月次集計と CSV 出力にも対応"
      />
      <AttendancePanel
        staffId={staff.id}
        staffName={staff.display_name}
        primaryStoreId={staff.primary_store_id}
        stores={(stores ?? []) as any}
        logs={(recentLogs ?? []) as any}
        isManager={isManager}
      />

      <AttendanceSummary
        initialMonth={monthStart.slice(0, 7)}
        staff={isManager ? ((allStaff ?? []) as any) : ([{ id: staff.id, display_name: staff.display_name }] as any)}
        stores={(stores ?? []) as any}
        daily={(dailyAll ?? []) as any}
        staffMap={staffMap}
        storeMap={storeMap}
      />
    </div>
  );
}
