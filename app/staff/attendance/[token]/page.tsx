import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { ToastProvider } from '@/components/ui/toast';
import { StaffAttendancePanel } from '@/components/attendance/staff-attendance-panel';
import { ChevronLeft } from 'lucide-react';
import { LogoIcon } from '@/components/ui/logo';

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
      <main className="min-h-screen bg-gradient-to-br from-vivie-100 via-vivie-50 to-white px-4 py-8">
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
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <LogoIcon size="sm" asImage />
              <span
                className="font-serif text-lg text-vivie-500"
                style={{ letterSpacing: '0.14em' }}
              >
                vivie
              </span>
            </div>
            <h1 className="font-serif text-2xl font-semibold text-ink-900">
              {(staff as any).display_name} さんの打刻
            </h1>
            <p className="mt-1 text-sm text-ink-500">店舗の半径内で打刻可能</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-vivie-200/70 px-3 py-1 text-xs font-medium text-vivie-800">
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
