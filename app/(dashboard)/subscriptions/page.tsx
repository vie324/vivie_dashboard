import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SquareSyncButton } from '@/components/members/sync-button';
import {
  SubscriptionMovementChart,
  SubscriptionRevenueChart,
  type MovementPoint,
  type SubRevenuePoint,
} from '@/components/subscriptions/subscription-charts';
import {
  SubscriptionsTable,
  subStatusInfo,
  type SubscriptionRow,
} from '@/components/subscriptions/subscriptions-table';
import { UserMinus, UserPlus, TrendingUp, Repeat } from 'lucide-react';
import { formatYen, formatDate, thisMonthJST, monthRange } from '@/lib/utils';
import { monthlyEquivalent } from '@/lib/square/client';
import { REFUND_CATEGORY } from '@/lib/square/payments';

export const dynamic = 'force-dynamic';

// 過去 N ヶ月の YYYY-MM リスト (古い順)
function lastMonths(n: number): string[] {
  const [y, m] = thisMonthJST().split('-').map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

export default async function SubscriptionsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role === 'store') redirect('/');
  const supabase = createClient();

  const month = thisMonthJST();
  const { start: monthStart, endExclusive: monthEndExclusive } = monthRange(month);
  const months = lastMonths(12);
  const chartStart = `${months[0]}-01`;

  const [{ data: subsRaw }, { data: plans }, { data: subCash }] = await Promise.all([
    // 統計と一覧の両方に使う (サロン規模なら全件で問題ない)
    supabase
      .from('member_subscriptions')
      .select(
        'id, status, started_at, next_billing_at, cancelled_at, created_at,' +
          ' member:members(id, full_name), plan:subscription_plans(name, monthly_price, cadence)',
      )
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('subscription_plans').select('*').order('monthly_price'),
    // 過去 12 ヶ月のサブスク関連の入出金 (実績売上と返金)
    supabase
      .from('cashbook_entries')
      .select('entry_date, amount, entry_type, category')
      .eq('sale_kind', 'subscription')
      .gte('entry_date', chartStart)
      .lt('entry_date', monthEndExclusive),
  ]);

  const subs = (subsRaw ?? []) as unknown as (SubscriptionRow & { created_at: string })[];

  // --- KPI 計算 ---
  // started_at が null の契約 (Webhook 経由など) は created_at で開始日を代用する
  const startRef = (s: (typeof subs)[number]) =>
    s.started_at ?? (s.created_at ? s.created_at.slice(0, 10) : null);

  const activeSubs = subs.filter((s) => subStatusInfo(s.status).group === 'active');
  const newThisMonth = subs.filter((s) => {
    const st = startRef(s);
    return st && st >= monthStart && st < monthEndExclusive;
  });
  const cancelledThisMonth = subs.filter(
    (s) => s.cancelled_at && s.cancelled_at >= monthStart && s.cancelled_at < monthEndExclusive,
  );

  // 月初時点のアクティブ契約数
  const activeAtMonthStart = subs.filter((s) => {
    const st = startRef(s);
    if (!st || st >= monthStart) return false;
    return !s.cancelled_at || s.cancelled_at >= monthStart;
  }).length;
  // 解約率の分母は「今月アクティブだった契約」(月初アクティブ + 今月新規)。
  // 月初のみを分母にすると当月中の契約→解約で 100% 超になり得る。
  const churnBase = activeAtMonthStart + newThisMonth.length;
  const churnRate =
    churnBase > 0 ? Math.round((cancelledThisMonth.length / churnBase) * 1000) / 10 : 0;
  const retentionRate = churnBase > 0 ? Math.round((100 - churnRate) * 10) / 10 : 100;

  // MRR: プラン価格を課金周期で月額換算して合算
  const totalMRR = activeSubs.reduce((sum, s) => {
    const p = s.plan as any;
    return sum + (p ? monthlyEquivalent(p.monthly_price ?? 0, p.cadence) : 0);
  }, 0);
  const arpu = activeSubs.length > 0 ? Math.round(totalMRR / activeSubs.length) : 0;

  // 実績サブスク売上 (今月・返金控除後)
  const cashRows = (subCash ?? []) as any[];
  const monthlyRevenue = new Map<string, number>();
  for (const e of cashRows) {
    const m = String(e.entry_date).slice(0, 7);
    const signed =
      e.entry_type === 'income'
        ? e.amount
        : e.category === REFUND_CATEGORY
          ? -e.amount
          : 0;
    monthlyRevenue.set(m, (monthlyRevenue.get(m) ?? 0) + signed);
  }
  const actualSubRevenue = monthlyRevenue.get(month) ?? 0;

  // --- 12 ヶ月の推移 ---
  const movementData: MovementPoint[] = months.map((m) => ({
    month: m,
    newCount: subs.filter((s) => s.started_at?.slice(0, 7) === m).length,
    cancelledCount: subs.filter((s) => s.cancelled_at?.slice(0, 7) === m).length,
  }));
  const revenueData: SubRevenuePoint[] = months.map((m) => ({
    month: m,
    revenue: monthlyRevenue.get(m) ?? 0,
  }));

  // プラン構成 (アクティブ契約の分布)
  const planMix = new Map<string, { count: number; mrr: number }>();
  for (const s of activeSubs) {
    const p = s.plan as any;
    const name = p?.name ?? 'プラン未紐付け';
    const cur = planMix.get(name) ?? { count: 0, mrr: 0 };
    cur.count += 1;
    cur.mrr += p ? monthlyEquivalent(p.monthly_price ?? 0, p.cadence) : 0;
    planMix.set(name, cur);
  }
  const planMixRows = Array.from(planMix.entries()).sort((a, b) => b[1].count - a[1].count);
  const unlinkedCount = activeSubs.filter((s) => !s.plan).length;

  return (
    <div className="space-y-6 stagger-children">
      <PageHeader
        title="サブスク管理"
        description="Square と自動同期。決済ベースの実績・解約・継続を一目で追えます"
        actions={<SquareSyncButton />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="アクティブ契約"
          value={`${activeSubs.length} 件`}
          hint={`継続率 ${retentionRate}% (今月)`}
          icon={<Repeat size={18} />}
          tone="rose"
        />
        <KpiCard
          label="今月の新規契約"
          value={`${newThisMonth.length} 件`}
          hint={`プラン ${(plans ?? []).filter((p: any) => p.is_active).length} 種類`}
          icon={<UserPlus size={18} />}
          tone="green"
        />
        <KpiCard
          label="今月の解約"
          value={`${cancelledThisMonth.length} 件`}
          hint={`解約率 ${churnRate}% (今月対象 ${churnBase} 件中)`}
          icon={<UserMinus size={18} />}
          tone={cancelledThisMonth.length > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label="MRR (月額換算)"
          value={formatYen(totalMRR)}
          hint={`実績 ${formatYen(actualSubRevenue)} ・ ARPU ${formatYen(arpu)}`}
          icon={<TrendingUp size={18} />}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>新規契約と解約の推移 (12ヶ月)</CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionMovementChart data={movementData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>サブスク売上の実績 (決済ベース・12ヶ月)</CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">出納帳のサブスク入金 − 返金</p>
          </CardHeader>
          <CardContent>
            <SubscriptionRevenueChart data={revenueData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>今月の解約 ({cancelledThisMonth.length} 件)</CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              フォローアップ次第で戻ってきていただけるお客様です
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {cancelledThisMonth.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                今月の解約はありません 🎉
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {cancelledThisMonth.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    {s.member ? (
                      <Link
                        href={`/members/${s.member.id}`}
                        className="flex-1 truncate font-medium hover:text-vivie-600"
                      >
                        {s.member.full_name}
                      </Link>
                    ) : (
                      <span className="flex-1 text-ink-400">—</span>
                    )}
                    <span className="truncate text-xs text-ink-500">{(s.plan as any)?.name ?? '—'}</span>
                    <span className="text-xs text-ink-500">
                      {formatYen((s.plan as any)?.monthly_price ?? 0)}
                    </span>
                    <span className="text-xs font-medium text-red-600">
                      {formatDate(s.cancelled_at)} 解約
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>プラン構成 (アクティブ)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {planMixRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">アクティブ契約がありません</p>
            ) : (
              planMixRows.map(([name, v]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-ink-700">{name}</span>
                  <span className="ml-2 shrink-0 text-xs text-ink-500">
                    {v.count} 件 ・ {formatYen(v.mrr)}/月
                  </span>
                </div>
              ))
            )}
            {unlinkedCount > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                プラン未紐付けの契約が {unlinkedCount} 件あります。「Square 同期」を実行すると
                カタログから自動で紐付きます。
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>契約一覧</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SubscriptionsTable rows={subs as SubscriptionRow[]} />
        </CardContent>
      </Card>
    </div>
  );
}
