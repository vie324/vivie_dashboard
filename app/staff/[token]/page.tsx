import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { ToastProvider } from '@/components/ui/toast';
import { Sparkles, FileBarChart2, MapPin, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StaffHubPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, primary_store:stores(name), is_active')
    .eq('daily_report_token', params.token)
    .maybeSingle();
  if (!staff || !staff.is_active) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: todayReport }, { data: lastClock }] = await Promise.all([
    supabase
      .from('daily_reports')
      .select('id, submitted_at')
      .eq('staff_id', staff.id)
      .eq('report_date', today)
      .maybeSingle(),
    supabase
      .from('attendance_logs')
      .select('kind, clocked_at')
      .eq('staff_id', staff.id)
      .order('clocked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const kindLabel: Record<string, string> = {
    clock_in: '出勤',
    clock_out: '退勤',
    break_start: '休憩開始',
    break_end: '休憩終了',
  };

  return (
    <ToastProvider>
      <main className="min-h-screen bg-gradient-to-br from-vivie-50 via-white to-ink-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <header className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-vivie-100 text-vivie-600">
              <Sparkles size={22} />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-ink-900">
              {(staff as any).display_name}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {(staff as any).primary_store?.name ?? '店舗未設定'}
            </p>
          </header>

          <div className="space-y-3">
            <ActionCard
              href={`/staff/attendance/${params.token}`}
              icon={<MapPin size={20} />}
              tone="rose"
              title="勤怠打刻"
              description="出勤 / 休憩 / 退勤を記録します"
              meta={lastClock ? `最終: ${kindLabel[(lastClock as any).kind]} ${formatDateTime((lastClock as any).clocked_at)}` : '本日まだ打刻なし'}
            />
            <ActionCard
              href={`/staff/report/${params.token}`}
              icon={<FileBarChart2 size={20} />}
              tone="amber"
              title="日報入力"
              description="本日の集客・施術・売上を記録します"
              meta={todayReport ? `本日入力済 (${formatDateTime((todayReport as any).submitted_at)})` : '本日まだ入力なし'}
            />
          </div>

          <p className="mt-8 text-center text-xs text-ink-400">
            この URL はあなた専用です。他の人と共有しないでください。
          </p>
        </div>
      </main>
    </ToastProvider>
  );
}

function ActionCard({
  href,
  icon,
  tone,
  title,
  description,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  tone: 'rose' | 'amber';
  title: string;
  description: string;
  meta: string;
}) {
  const toneClass: Record<string, string> = {
    rose: 'bg-vivie-100 text-vivie-600',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-ink-100 bg-white p-5 shadow-sm hover:border-vivie-200 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg font-semibold text-ink-900">{title}</p>
          <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          <p className="mt-2 text-xs text-ink-400">{meta}</p>
        </div>
        <ChevronRight size={18} className="mt-1.5 text-ink-300" />
      </div>
    </Link>
  );
}
