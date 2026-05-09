import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, ClipboardList, Wallet, FileBarChart2, TrendingUp, CalendarRange } from 'lucide-react';
import { formatYen, formatDate, todayISO } from '@/lib/utils';
import { getCurrentStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardHome() {
  const supabase = createClient();
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const today = todayISO();
  const monthStart = today.slice(0, 7) + '-01';

  // 集計クエリを並列実行
  const [
    membersRes,
    activeSubsRes,
    monthCashRes,
    monthReportRes,
    counselingRes,
    recentVisitsRes,
  ] = await Promise.all([
    supabase.from('members').select('id, status', { count: 'exact', head: false }),
    supabase
      .from('member_subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ACTIVE', 'active']),
    supabase
      .from('cashbook_entries')
      .select('amount, entry_type')
      .gte('entry_date', monthStart)
      .lte('entry_date', today),
    supabase
      .from('daily_reports')
      .select('existing_treatment_count, repeat_count, total_sales')
      .gte('report_date', monthStart),
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .gte('submitted_at', monthStart),
    supabase
      .from('visits')
      .select('id, member_id, visit_date, menu, amount, members(full_name)')
      .order('visit_date', { ascending: false })
      .limit(8),
  ]);

  const totalMembers = membersRes.count ?? 0;
  const activeMembers = (membersRes.data ?? []).filter((m) => m.status === 'active').length;
  const activeSubs = activeSubsRes.count ?? 0;
  const counselingCount = counselingRes.count ?? 0;

  const cashEntries = monthCashRes.data ?? [];
  const monthIncome = cashEntries
    .filter((e) => e.entry_type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);
  const monthExpense = cashEntries
    .filter((e) => e.entry_type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const reports = monthReportRes.data ?? [];
  const totalExisting = reports.reduce((sum, r) => sum + r.existing_treatment_count, 0);
  const totalRepeat = reports.reduce((sum, r) => sum + r.repeat_count, 0);
  const repeatRate = totalExisting > 0 ? Math.round((totalRepeat / totalExisting) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title={`おかえりなさい、${staff.display_name}さん`}
        description={`今月 (${monthStart.slice(0, 7)}) の概況です`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="総会員数"
          value={totalMembers}
          hint={`アクティブ ${activeMembers}名`}
          icon={<Users size={18} />}
          tone="rose"
        />
        <KpiCard
          label="サブスク継続"
          value={activeSubs}
          hint="Square 連携"
          icon={<TrendingUp size={18} />}
          tone="amber"
        />
        <KpiCard
          label="今月の売上"
          value={formatYen(monthIncome)}
          hint={`支出 ${formatYen(monthExpense)}`}
          icon={<Wallet size={18} />}
          tone="green"
        />
        <KpiCard
          label="リピート率"
          value={`${repeatRate}%`}
          hint={`既存${totalExisting}件中 ${totalRepeat}件`}
          icon={<FileBarChart2 size={18} />}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>最近の来店履歴</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(recentVisitsRes.data ?? []).length === 0 ? (
              <EmptyState
                icon={<CalendarRange size={28} />}
                title="まだ来店記録がありません"
                description="施術を完了すると、ここに最近の来店が表示されます"
              />
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>会員</th>
                    <th>メニュー</th>
                    <th className="text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentVisitsRes.data ?? []).map((v: any) => (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap">{formatDate(v.visit_date)}</td>
                      <td>{v.members?.full_name ?? '—'}</td>
                      <td className="text-ink-500">{v.menu ?? '—'}</td>
                      <td className="text-right">{formatYen(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今月の入力状況</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow icon={<ClipboardList size={16} />} label="カウンセリング" value={`${counselingCount} 件`} />
            <SummaryRow icon={<FileBarChart2 size={16} />} label="日報" value={`${reports.length} 件`} />
            <SummaryRow icon={<Wallet size={16} />} label="出納帳" value={`${cashEntries.length} 件`} />
            <SummaryRow
              icon={<TrendingUp size={16} />}
              label="施術件数"
              value={`${totalExisting + totalRepeat} 件`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/50 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-ink-700">
        <span className="text-vivie-500">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-medium text-ink-900">{value}</span>
    </div>
  );
}
