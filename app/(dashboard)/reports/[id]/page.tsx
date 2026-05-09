import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DailyReportForm } from '@/components/reports/daily-report-form';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EditReportPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');

  const supabase = createClient();
  const [{ data: report }, { data: stores }] = await Promise.all([
    supabase.from('daily_reports').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
  ]);

  if (!report) notFound();
  const isManager = staff.role === 'admin' || staff.role === 'manager';
  const isOwner = (report as any).staff_id === staff.id;
  if (!isManager && !isOwner) redirect('/reports');

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        日報一覧に戻る
      </Link>
      <PageHeader title="日報を編集" description={(report as any).report_date} />
      <DailyReportForm
        stores={(stores ?? []) as any}
        staffId={(report as any).staff_id}
        staffName={staff.display_name}
        defaultStoreId={(report as any).store_id}
        initial={report as any}
      />
    </div>
  );
}
