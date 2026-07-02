import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { MonthPicker } from '@/components/dashboard/month-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/kpi-card';
import {
  ReconciliationChart,
  type ReconciliationPoint,
} from '@/components/sales/reconciliation-chart';
import {
  Wallet,
  Undo2,
  FileBarChart2,
  Scale,
  TrendingUp,
  CreditCard,
  Ticket,
  Coins,
  AlertTriangle,
} from 'lucide-react';
import { formatYen, todayISO, thisMonthJST, monthRange } from '@/lib/utils';
import { REFUND_CATEGORY } from '@/lib/square/payments';
import type { MonthlyGoal } from '@/types/database';

export const dynamic = 'force-dynamic';

// 売上分析: 決済ベース (Square + 出納帳) とスタッフ日報の両方の数字を
// 日単位で照合し、差異・返金・着地予測まで一画面で追えるようにする。
export default async function SalesPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/');

  const supabase = createClient();
  const month =
    searchParams?.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month)
      ? searchParams.month
      : thisMonthJST();
  const { start, endExclusive, endInclusive } = monthRange(month);
  const today = todayISO();
  const isCurrentMonth = month === thisMonthJST();
  // 今月表示では未来日付の記帳 (前受けなど) を除外し、チャート・ダッシュボードと揃える
  const lastDay = isCurrentMonth ? today : endInclusive;

  const [{ data: cash }, { data: reports }, { data: goalRows }] = await Promise.all([
    supabase
      .from('cashbook_entries')
      .select('entry_date, amount, entry_type, sale_kind, category, source, description')
      .gte('entry_date', start)
      .lte('entry_date', lastDay)
      .order('entry_date'),
    supabase
      .from('daily_reports')
      .select('report_date, total_sales, discount_total')
      .gte('report_date', start)
      .lte('report_date', lastDay),
    supabase.from('monthly_goals').select('*').eq('goal_month', month),
  ]);

  const entries = (cash ?? []) as any[];
  const income = entries.filter((e) => e.entry_type === 'income');
  const refundEntries = entries.filter(
    (e) => e.entry_type === 'expense' && e.category === REFUND_CATEGORY,
  );

  const grossIncome = income.reduce((s, e) => s + e.amount, 0);
  const refundTotal = refundEntries.reduce((s, e) => s + e.amount, 0);
  const netIncome = grossIncome - refundTotal;

  const kindSum = (kind: string) =>
    income.filter((e) => e.sale_kind === kind).reduce((s, e) => s + e.amount, 0);
  const subscriptionIncome = kindSum('subscription');
  const ticketIncome = kindSum('ticket');
  const productIncome = kindSum('product');
  const otherIncome = grossIncome - subscriptionIncome - ticketIncome - productIncome;
  const squareIncome = income
    .filter((e) => e.source === 'square')
    .reduce((s, e) => s + e.amount, 0);

  // 日報売上 (値引後)
  const reportRows = (reports ?? []) as any[];
  const reportedNet = reportRows.reduce(
    (s, r) => s + (r.total_sales ?? 0) - (r.discount_total ?? 0),
    0,
  );
  const reportedGross = reportRows.reduce((s, r) => s + (r.total_sales ?? 0), 0);
  const delta = netIncome - reportedNet;

  // --- 日次の照合データ ---
  const settledByDay = new Map<string, number>();
  for (const e of income) {
    settledByDay.set(e.entry_date, (settledByDay.get(e.entry_date) ?? 0) + e.amount);
  }
  for (const e of refundEntries) {
    settledByDay.set(e.entry_date, (settledByDay.get(e.entry_date) ?? 0) - e.amount);
  }
  const reportedByDay = new Map<string, number>();
  for (const r of reportRows) {
    reportedByDay.set(
      r.report_date,
      (reportedByDay.get(r.report_date) ?? 0) + (r.total_sales ?? 0) - (r.discount_total ?? 0),
    );
  }

  const chartData: ReconciliationPoint[] = [];
  for (let d = start; d <= lastDay; d = nextDay(d)) {
    chartData.push({
      date: d,
      settled: settledByDay.get(d) ?? 0,
      reported: reportedByDay.get(d) ?? 0,
    });
  }

  // 差異のある日 (どちらかが 0 でない かつ 一致しない)。返金のみの日 (settled < 0) も含める
  const mismatchDays = chartData
    .filter((p) => p.settled !== p.reported && (p.settled !== 0 || p.reported !== 0))
    .map((p) => ({ ...p, diff: p.settled - p.reported }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // --- 着地予測 (今月のみ) ---
  const daysInMonth = Number(endInclusive.slice(8));
  const daysElapsed = isCurrentMonth ? Math.max(1, Number(today.slice(8))) : daysInMonth;
  const forecast = Math.round((netIncome / daysElapsed) * daysInMonth);

  // 目標 (全店舗行 > 店舗別合算)
  const goals = (goalRows ?? []) as MonthlyGoal[];
  const allGoal = goals.find((g) => g.store_id === null);
  const salesTarget = allGoal
    ? allGoal.sales_target ?? 0
    : goals.reduce((s, g) => s + (g.sales_target ?? 0), 0);
  const forecastRate = salesTarget > 0 ? Math.round((forecast / salesTarget) * 100) : null;

  return (
    <div className="space-y-6 stagger-children">
      <PageHeader
        title="売上分析"
        description="決済ベースの実売上とスタッフ日報を日単位で照合します"
        actions={<MonthPicker value={month} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="売上 (決済ベース・返金控除後)"
          value={formatYen(netIncome)}
          hint={`決済 ${formatYen(grossIncome)}${refundTotal > 0 ? ` − 返金 ${formatYen(refundTotal)}` : ''}`}
          icon={<Wallet size={18} />}
          tone="green"
        />
        <KpiCard
          label="日報売上 (値引後)"
          value={formatYen(reportedNet)}
          hint={`申告総額 ${formatYen(reportedGross)}`}
          icon={<FileBarChart2 size={18} />}
          tone="amber"
        />
        <KpiCard
          label="差異 (決済 − 日報)"
          value={`${delta >= 0 ? '+' : ''}${formatYen(delta)}`}
          hint={mismatchDays.length > 0 ? `差異のある日: ${mismatchDays.length}日` : '完全一致'}
          icon={<Scale size={18} />}
          tone={Math.abs(delta) > 0 ? 'rose' : 'green'}
        />
        <KpiCard
          label={isCurrentMonth ? '着地予測' : '月間確定'}
          value={formatYen(forecast)}
          hint={
            forecastRate != null
              ? `目標 ${formatYen(salesTarget)} の ${forecastRate}%`
              : '目標未設定 (目標管理から設定)'
          }
          icon={<TrendingUp size={18} />}
          tone="blue"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日次売上の照合 ({month})</CardTitle>
          <p className="mt-0.5 text-xs text-ink-500">
            実線 = 決済ベース (Square 決済 + 出納帳入金 − 返金) ・ 破線 = スタッフ日報 (値引後)
          </p>
        </CardHeader>
        <CardContent>
          <ReconciliationChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>売上内訳 (決済ベース)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BreakdownRow icon={<CreditCard size={15} />} label="サブスク" value={subscriptionIncome} total={grossIncome} />
            <BreakdownRow icon={<Ticket size={15} />} label="回数券" value={ticketIncome} total={grossIncome} />
            <BreakdownRow icon={<Coins size={15} />} label="物販" value={productIncome} total={grossIncome} />
            <BreakdownRow icon={<Wallet size={15} />} label="単発・その他" value={otherIncome} total={grossIncome} />
            <div className="border-t border-ink-100 pt-3 text-xs text-ink-500">
              Square 決済経由: {formatYen(squareIncome)} (
              {grossIncome > 0 ? Math.round((squareIncome / grossIncome) * 100) : 0}%)
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>差異のある日</CardTitle>
            <span className="text-xs text-ink-400">大きい順・上位 10 日</span>
          </CardHeader>
          <CardContent className="p-0">
            {mismatchDays.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                決済ベースと日報が完全に一致しています 🎉
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th className="text-right">決済ベース</th>
                      <th className="text-right">日報 (値引後)</th>
                      <th className="text-right">差異</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatchDays.slice(0, 10).map((d) => (
                      <tr key={d.date}>
                        <td className="font-mono text-xs">{d.date}</td>
                        <td className="text-right">{formatYen(d.settled)}</td>
                        <td className="text-right">{formatYen(d.reported)}</td>
                        <td
                          className={`text-right font-medium ${
                            d.diff > 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {d.diff > 0 ? '+' : ''}
                          {formatYen(d.diff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-2.5 text-xs text-ink-500">
              差異の原因調査は
              <Link href="/cashbook" className="mx-1 text-vivie-600 hover:underline">
                出納帳
              </Link>
              と
              <Link href="/reports" className="mx-1 text-vivie-600 hover:underline">
                日報一覧
              </Link>
              から。Square 決済の取りこぼしは会員管理の「Square 同期」で自動補完されます。
            </div>
          </CardContent>
        </Card>
      </div>

      {refundEntries.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Undo2 className="text-amber-600" size={18} />
              返金 ({refundEntries.length} 件 ・ {formatYen(refundTotal)})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th className="text-right">金額</th>
                    <th>区分</th>
                    <th>メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {refundEntries.map((r, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{r.entry_date}</td>
                      <td className="text-right text-red-600">−{formatYen(r.amount)}</td>
                      <td className="text-xs">{saleKindLabel(r.sale_kind)}</td>
                      <td className="max-w-[24rem] truncate text-xs text-ink-500">
                        {r.description ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportRows.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-amber-800">
            <AlertTriangle size={18} className="shrink-0 text-amber-600" />
            この月の日報がまだ入力されていません。日報が揃うと決済ベースとの照合が機能します。
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function nextDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

function saleKindLabel(kind: string | null): string {
  switch (kind) {
    case 'subscription':
      return 'サブスク';
    case 'ticket':
      return '回数券';
    case 'product':
      return '物販';
    case 'single':
      return '単発';
    default:
      return 'その他';
  }
}

function BreakdownRow({
  icon,
  label,
  value,
  total,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-ink-700">
          <span className="text-vivie-500">{icon}</span>
          {label}
        </span>
        <span className="font-medium text-ink-900">
          {formatYen(value)}
          <span className="ml-1.5 text-xs font-normal text-ink-400">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-vivie-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
