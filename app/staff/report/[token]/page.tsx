import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { DailyReportForm } from '@/components/reports/daily-report-form';
import { ToastProvider } from '@/components/ui/toast';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StaffReportPage({
  params,
}: {
  params: { token: string };
}) {
  // 公開ページは service client で staff を引き当て (RLS 越しに anon では引けないため)
  const supabase = createServiceClient();
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, primary_store_id, is_active')
    .eq('daily_report_token', params.token)
    .maybeSingle();

  if (!staff || !staff.is_active) notFound();

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <ToastProvider>
      <main className="min-h-screen bg-gradient-to-br from-vivie-50 via-white to-ink-50 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4">
            <a
              href={`/staff/${params.token}`}
              className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
            >
              ← ハブに戻る
            </a>
          </div>

          <header className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-vivie-100 text-vivie-600">
              <Sparkles size={22} />
            </div>
            <h1 className="font-serif text-3xl font-semibold text-ink-900">
              {staff.display_name} さんの日報
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              本日の集客・施術・売上を記入してください
            </p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-vivie-100 px-3 py-1 text-xs font-medium text-vivie-700">
              ⚡ {staff.display_name} として記録されます
            </p>
          </header>
          <DailyReportForm
            stores={stores ?? []}
            staffId={staff.id}
            staffName={staff.display_name}
            defaultStoreId={staff.primary_store_id}
            token={params.token}
          />
        </div>
      </main>
    </ToastProvider>
  );
}
