import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { ToastProvider } from '@/components/ui/toast';
import { StaffAttendancePanel } from '@/components/attendance/staff-attendance-panel';
import { Sparkles, ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StaffAttendancePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServiceClient();
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, primary_store_id, is_active')
    .eq('daily_report_token', params.token)
    .maybeSingle();
  if (!staff || !staff.is_active) notFound();

  const [{ data: stores }, { data: recentLogs }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name, latitude, longitude, radius_meters')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('attendance_logs')
      .select('id, kind, clocked_at, distance_meters, store:stores(name)')
      .eq('staff_id', (staff as any).id)
      .order('clocked_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <ToastProvider>
      <main className="min-h-screen bg-gradient-to-br from-vivie-50 via-white to-ink-50 px-4 py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-4">
            <Link
              href={`/staff/${params.token}`}
              className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
            >
              <ChevronLeft size={14} />
              戻る
            </Link>
          </div>

          <header className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-vivie-100 text-vivie-600">
              <Sparkles size={22} />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-ink-900">
              {(staff as any).display_name} さんの打刻
            </h1>
            <p className="mt-1 text-sm text-ink-500">店舗の半径内で打刻可能</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-vivie-100 px-3 py-1 text-xs font-medium text-vivie-700">
              ⚡ {(staff as any).display_name} として記録されます
            </p>
          </header>

          <StaffAttendancePanel
            token={params.token}
            staffId={(staff as any).id}
            staffName={(staff as any).display_name}
            primaryStoreId={(staff as any).primary_store_id}
            stores={(stores ?? []) as any}
            logs={(recentLogs ?? []) as any}
          />
        </div>
      </main>
    </ToastProvider>
  );
}
