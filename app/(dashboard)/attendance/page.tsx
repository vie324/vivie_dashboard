import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { AttendancePanel } from '@/components/attendance/attendance-panel';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const supabase = createClient();
  const isManager = staff.role === 'admin' || staff.role === 'manager';

  // 自分の所属店舗
  const [{ data: stores }, { data: recentLogs }] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="勤怠管理"
        description="店舗の半径内でのみ打刻可能な GPS 認証方式を採用しています"
      />
      <AttendancePanel
        staffId={staff.id}
        staffName={staff.display_name}
        primaryStoreId={staff.primary_store_id}
        stores={(stores ?? []) as any}
        logs={(recentLogs ?? []) as any}
        isManager={isManager}
      />
    </div>
  );
}
