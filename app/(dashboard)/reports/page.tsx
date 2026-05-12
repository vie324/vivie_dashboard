import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyButton } from '@/components/ui/copy-button';
import { FileBarChart2, Plus, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { formatDate, formatYen, todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  // 店舗アカウントは日報 (個人別) にアクセス不可
  if (staff.role === 'store') redirect('/');
  const supabase = createClient();

  const monthStart = todayISO().slice(0, 7) + '-01';
  const isManager = staff.role === 'admin' || staff.role === 'manager';

  const reportsQuery = supabase
    .from('daily_reports')
    .select('*, staff:staff(display_name), store:stores(name)')
    .gte('report_date', monthStart)
    .order('report_date', { ascending: false })
    .limit(200);
  if (!isManager) reportsQuery.eq('staff_id', staff.id);

  const [{ data: reports }, { data: allStaff }] = await Promise.all([
    reportsQuery,
    isManager
      ? supabase
          .from('staff')
          .select('id, display_name, role, daily_report_token, primary_store:stores(name)')
          .eq('is_active', true)
          .order('display_name')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const totalExisting = (reports ?? []).reduce((sum: number, r: any) => sum + r.existing_treatment_count, 0);
  const totalRepeat = (reports ?? []).reduce((sum: number, r: any) => sum + r.repeat_count, 0);
  const repeatRate = totalExisting > 0 ? Math.round((totalRepeat / totalExisting) * 100) : 0;
  const totalSales = (reports ?? []).reduce((sum: number, r: any) => sum + r.total_sales, 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="日報"
        description={isManager ? '全スタッフの日報を確認できます' : 'あなたが提出した日報を確認できます'}
        actions={
          <Link href="/reports/new">
            <Button size="sm">
              <Plus size={14} />
              日報を入力
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="今月の日報数" value={`${(reports ?? []).length} 件`} />
        <Stat label="今月のリピート率" value={`${repeatRate}%`} hint={`既存${totalExisting} / リピート${totalRepeat}`} />
        <Stat label="今月の合計売上" value={formatYen(totalSales)} />
      </div>

      {isManager && (allStaff ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>スタッフ専用 入力 URL</CardTitle>
            <p className="text-xs text-ink-500 mt-1">
              各スタッフに個別 URL を発行しています。LINE 等で共有してください。
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(allStaff ?? []).map((s: any) => {
              const url = s.daily_report_token
                ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/staff/report/${s.daily_report_token}`
                : null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{s.display_name}</p>
                    <p className="text-xs text-ink-400 truncate">
                      {s.primary_store?.name ?? '店舗未設定'}
                    </p>
                  </div>
                  {url ? (
                    <div className="flex items-center gap-1.5">
                      <CopyButton value={url} />
                      <Link
                        href={url}
                        target="_blank"
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-vivie-100 hover:text-vivie-600"
                        aria-label="開く"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  ) : (
                    <Badge tone="amber">未発行</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {(reports ?? []).length === 0 ? (
            <EmptyState
              icon={<FileBarChart2 size={28} />}
              title="今月の日報はまだありません"
              description="日々の集客・施術・売上を記録すると、リピート率や月間合計が自動集計されます"
              action={
                <Link href="/reports/new">
                  <Button size="sm">日報を入力</Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>スタッフ</th>
                    <th>店舗</th>
                    <th className="text-right">既存</th>
                    <th className="text-right">リピート</th>
                    <th className="text-right">新規</th>
                    <th className="text-right">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports ?? []).map((r: any) => {
                    const newCount = r.hpb_new_count + r.meta_new_count + (r.minimo_new_count ?? 0) + r.referral_new_count;
                    const rate = r.existing_treatment_count > 0
                      ? Math.round((r.repeat_count / r.existing_treatment_count) * 100)
                      : 0;
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-xs text-ink-500">
                          <Link href={`/reports/${r.id}`} className="hover:text-vivie-600">
                            {formatDate(r.report_date)}
                          </Link>
                        </td>
                        <td className="text-sm">{r.staff?.display_name ?? '—'}</td>
                        <td className="text-xs text-ink-500">{r.store?.name ?? '—'}</td>
                        <td className="text-right text-sm">{r.existing_treatment_count}</td>
                        <td className="text-right text-sm">
                          {r.repeat_count}
                          <span className="ml-1 text-xs text-ink-400">({rate}%)</span>
                        </td>
                        <td className="text-right text-sm">{newCount}</td>
                        <td className="text-right text-sm font-medium">{formatYen(r.total_sales)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
