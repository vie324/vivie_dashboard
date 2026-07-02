import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { DashboardKpis } from '@/components/dashboard/dashboard-kpis';
import type { MetricsSummary } from '@/app/api/metrics/summary/route';
import { StoreHome } from '@/components/dashboard/store-home';
import { GoalProgressCard } from '@/components/dashboard/goal-progress-card';
import { Wallet, FileBarChart2, ClipboardList, Activity, CalendarRange, AlertTriangle } from 'lucide-react';
import { formatYen, formatDate, todayISO, monthRange, ymd } from '@/lib/utils';
import { REFUND_CATEGORY } from '@/lib/square/payments';
import { getCurrentStaff } from '@/lib/auth';
import { getGoalProgress } from '@/lib/goals';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardHome() {
  const supabase = createClient();
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const today = todayISO();
  const month = today.slice(0, 7);
  const { start: monthStart, endExclusive: monthEndExclusive } = monthRange(month);

  // 店舗ロール (iPad / 店舗 PC) は専用のシンプルなトップを表示
  if (staff.role === 'store') {
    const [{ data: expiringTickets }, goalProgress] = await Promise.all([
      supabase
        .from('ticket_overview')
        .select(
          'id, member_id, member_name, plan_name, remaining_count, total_count, expires_at, days_until_expiry',
        )
        .eq('effective_status', 'active')
        .lte('days_until_expiry', 30)
        .gte('days_until_expiry', 0)
        .order('days_until_expiry', { ascending: true })
        .limit(8),
      getGoalProgress(supabase, { month: monthStart.slice(0, 7), storeId: staff.primary_store_id }),
    ]);
    return (
      <StoreHome
        staff={staff}
        expiringTickets={(expiringTickets ?? []) as any[]}
        goalProgress={goalProgress}
      />
    );
  }

  const [
    membersRes,
    activeMembersRes,
    activeSubsRes,
    monthCashRes,
    monthReportRes,
    counselingRes,
    recentVisitsRes,
    recentTreatmentsRes,
    monthTreatmentCountRes,
    dailySalesRes,
    expiringTicketsRes,
    goalProgress,
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('member_subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ACTIVE', 'active']),
    // /api/metrics/summary (期間タブ切替後) と同じ両端含む窓に揃える
    supabase
      .from('cashbook_entries')
      .select('amount, entry_type, sale_kind, category')
      .gte('entry_date', monthStart)
      .lte('entry_date', today),
    supabase
      .from('daily_reports')
      .select(
        'existing_treatment_count, repeat_count, total_sales, discount_total, hpb_new_count, hpb_contract_count,' +
          ' meta_new_count, meta_contract_count, minimo_new_count, minimo_contract_count,' +
          ' referral_new_count, referral_contract_count',
      )
      .gte('report_date', monthStart)
      .lte('report_date', today),
    // JST の月初 00:00 以降 (submitted_at は timestamptz)
    supabase
      .from('counseling_records')
      .select('id', { count: 'exact', head: true })
      .gte('submitted_at', `${monthStart}T00:00:00+09:00`)
      .lt('submitted_at', `${monthEndExclusive}T00:00:00+09:00`),
    supabase
      .from('visits')
      .select('id, member_id, visit_date, menu, amount, members(full_name, line_picture_url)')
      .order('visit_date', { ascending: false })
      .limit(5),
    supabase
      .from('treatment_reports')
      .select('id, treatment_date, menu, amount, member:members(full_name, line_picture_url), is_first_visit, contracted, line_sent_at')
      .order('treatment_date', { ascending: false })
      .limit(5),
    // 今月の施術件数 (正確なカウント)
    supabase
      .from('treatment_reports')
      .select('id', { count: 'exact', head: true })
      .gte('treatment_date', monthStart)
      .lte('treatment_date', today),
    // 過去 30 日の日次売上
    supabase
      .from('cashbook_entries')
      .select('entry_date, amount, entry_type')
      .gte('entry_date', ymd(new Date(Date.now() - 30 * 86400000)))
      .lte('entry_date', today)
      .eq('entry_type', 'income'),
    // 期限切れ間近 (30日以内) の有効チケット
    supabase
      .from('ticket_overview')
      .select('id, member_id, member_name, plan_name, remaining_count, total_count, expires_at, days_until_expiry')
      .eq('effective_status', 'active')
      .lte('days_until_expiry', 30)
      .gte('days_until_expiry', 0)
      .order('days_until_expiry', { ascending: true })
      .limit(8),
    // 今月の目標達成状況 (全店舗)
    getGoalProgress(supabase, { month: monthStart.slice(0, 7) }),
  ]);

  const totalMembers = membersRes.count ?? 0;
  const counselingCount = counselingRes.count ?? 0;

  const cashEntries = monthCashRes.data ?? [];
  const incomeEntries = cashEntries.filter((e: any) => e.entry_type === 'income');
  const refundEntries = cashEntries.filter(
    (e: any) => e.entry_type === 'expense' && e.category === REFUND_CATEGORY,
  );
  const monthIncome = incomeEntries.reduce((sum: number, e: any) => sum + e.amount, 0);
  const monthRefunds = refundEntries.reduce((sum: number, e: any) => sum + e.amount, 0);
  // 内訳は区分ごとの返金も控除した純額 (/api/metrics/summary と同じ定義)
  const kindNet = (kind: string) =>
    incomeEntries
      .filter((e: any) => e.sale_kind === kind)
      .reduce((sum: number, e: any) => sum + e.amount, 0) -
    refundEntries
      .filter((e: any) => e.sale_kind === kind)
      .reduce((sum: number, e: any) => sum + e.amount, 0);
  const subscriptionIncome = kindNet('subscription');
  const ticketIncome = kindNet('ticket');
  const monthExpense = cashEntries
    .filter((e: any) => e.entry_type === 'expense')
    .reduce((sum: number, e: any) => sum + e.amount, 0);

  const reports = monthReportRes.data ?? [];
  const sumCol = (col: string) => reports.reduce((s: number, r: any) => s + (r[col] ?? 0), 0);
  const totalExisting = sumCol('existing_treatment_count');
  const totalRepeat = sumCol('repeat_count');
  const totalNew =
    sumCol('hpb_new_count') + sumCol('meta_new_count') + sumCol('minimo_new_count') + sumCol('referral_new_count');
  const totalContract =
    sumCol('hpb_contract_count') +
    sumCol('meta_contract_count') +
    sumCol('minimo_contract_count') +
    sumCol('referral_contract_count');

  // 期間タブ初期値 (今月)。クライアントで期間を変えると /api/metrics/summary で再取得する。
  const initialSummary: MetricsSummary = {
    from: monthStart,
    to: today,
    totalMembers,
    activeMembers: activeMembersRes.count ?? 0,
    activeSubs: activeSubsRes.count ?? 0,
    income: monthIncome,
    refunds: monthRefunds,
    netIncome: monthIncome - monthRefunds,
    // 値引後 (売上分析ページ・/api/metrics/summary と同じ定義)
    reportedSales: sumCol('total_sales') - sumCol('discount_total'),
    subscriptionIncome,
    ticketIncome,
    otherIncome: monthIncome - monthRefunds - subscriptionIncome - ticketIncome,
    expense: monthExpense,
    newCount: totalNew,
    contractCount: totalContract,
    contractRate: totalNew > 0 ? Math.round((totalContract / totalNew) * 100) : 0,
    existing: totalExisting,
    repeat: totalRepeat,
    repeatRate: totalExisting > 0 ? Math.round((totalRepeat / totalExisting) * 100) : 0,
  };

  // 30 日トレンド (バケットキーは entry_date と同じ JST 暦日で揃える)
  const dailyMap = new Map<string, number>();
  (dailySalesRes.data ?? []).forEach((e: any) => {
    dailyMap.set(e.entry_date, (dailyMap.get(e.entry_date) ?? 0) + e.amount);
  });
  const trendData = [];
  for (let i = 29; i >= 0; i--) {
    const d = ymd(new Date(Date.now() - i * 86400000));
    trendData.push({ date: d, income: dailyMap.get(d) ?? 0 });
  }

  return (
    <div className="space-y-6 stagger-children">
      <PageHeader
        title={`おかえりなさい、${staff.display_name}さん`}
        description={`今月 (${monthStart.slice(0, 7)}) の概況です`}
      />

      <DashboardKpis initial={initialSummary} />

      <GoalProgressCard progress={goalProgress} />

      {(expiringTicketsRes.data ?? []).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="text-amber-600" size={18} />
              30日以内に期限切れの回数券 ({(expiringTicketsRes.data ?? []).length}件)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-amber-200">
              {(expiringTicketsRes.data ?? []).map((t: any) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Link
                    href={`/members/${t.member_id}`}
                    className="flex-1 font-medium hover:text-vivie-600"
                  >
                    {t.member_name ?? '—'}
                  </Link>
                  <span className="text-xs text-ink-600">{t.plan_name}</span>
                  <span className="text-xs text-ink-500">
                    残 {t.remaining_count}/{t.total_count}
                  </span>
                  <span className="text-xs font-medium text-amber-700">
                    {formatDate(t.expires_at)} (あと {Math.max(0, t.days_until_expiry)}日)
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-amber-200 px-5 py-2 bg-amber-50/60">
              <Link href="/tickets" className="text-xs text-vivie-700 hover:underline">
                回数券一覧で詳細を確認 →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>過去30日の売上推移</CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              出納帳の入金記録ベース
            </p>
          </CardHeader>
          <CardContent>
            <SalesTrend data={trendData} />
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
            <SummaryRow icon={<Activity size={16} />} label="施術件数" value={`${(recentTreatmentsRes.data ?? []).length}+ 件`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>最近の来店履歴</CardTitle>
            <Link href="/members" className="text-xs text-ink-500 hover:text-vivie-600">すべて見る →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {(recentVisitsRes.data ?? []).length === 0 ? (
              <EmptyState
                icon={<CalendarRange size={28} />}
                title="まだ来店記録がありません"
                description="施術を完了すると、ここに最近の来店が表示されます"
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {(recentVisitsRes.data ?? []).map((v: any) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={v.members?.full_name ?? '?'} src={v.members?.line_picture_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.members?.full_name ?? '—'}</p>
                      <p className="text-xs text-ink-400 truncate">
                        {formatDate(v.visit_date)} ・ {v.menu ?? '—'}
                      </p>
                    </div>
                    <span className="text-sm text-ink-700">{formatYen(v.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>最近の施術レポート</CardTitle>
            <Link href="/treatments" className="text-xs text-ink-500 hover:text-vivie-600">すべて見る →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {(recentTreatmentsRes.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Activity size={28} />}
                title="まだ施術レポートがありません"
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {(recentTreatmentsRes.data ?? []).map((t: any) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={t.member?.full_name ?? '?'} src={t.member?.line_picture_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <Link href={`/treatments/${t.id}`} className="text-sm font-medium truncate hover:text-vivie-600">
                        {t.member?.full_name ?? '—'}
                      </Link>
                      <p className="text-xs text-ink-400 truncate">
                        {formatDate(t.treatment_date)} ・ {t.menu ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {t.is_first_visit && !t.contracted && !t.line_sent_at && (
                        <span className="text-[10px] rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 font-medium">LINE未送信</span>
                      )}
                      {t.line_sent_at && (
                        <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-1.5 py-0.5 font-medium">LINE送信済</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
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

import { TrendChart } from '@/components/dashboard/trend-chart';
function SalesTrend({ data }: { data: any[] }) {
  return <TrendChart data={data} />;
}
