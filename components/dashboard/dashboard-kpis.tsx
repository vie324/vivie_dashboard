'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PeriodTabs, periodRange, type PeriodKey } from './period-tabs';
import { KpiCard } from './kpi-card';
import {
  Users,
  TrendingUp,
  Wallet,
  Handshake,
  Loader2,
  CreditCard,
  Ticket,
  Coins,
  FileBarChart2,
} from 'lucide-react';
import { formatYen } from '@/lib/utils';
import type { MetricsSummary } from '@/app/api/metrics/summary/route';

// 期間タブの切り替えで KPI を実際に再取得する。
export function DashboardKpis({ initial }: { initial: MetricsSummary }) {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [data, setData] = useState<MetricsSummary>(initial);
  const [loading, setLoading] = useState(false);
  // 連打時に古いレスポンスで上書きされないようリクエスト世代を持つ
  const requestSeq = useRef(0);

  async function changePeriod(p: PeriodKey) {
    setPeriod(p);
    setLoading(true);
    const seq = ++requestSeq.current;
    try {
      const { from, to } = periodRange(p);
      const res = await fetch(`/api/metrics/summary?from=${from}&to=${to}`, {
        cache: 'no-store',
      });
      if (res.ok && seq === requestSeq.current) {
        setData(await res.json());
      }
    } catch {
      // ネットワークエラー時は直前の値を保持
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  const delta = data.netIncome - data.reportedSales;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <PeriodTabs value={period} onChange={changePeriod} />
        {loading && (
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <Loader2 size={12} className="animate-spin" />
            更新中…
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="売上 (決済ベース)"
          value={formatYen(data.netIncome)}
          hint={
            data.refunds > 0
              ? `決済 ${formatYen(data.income)} − 返金 ${formatYen(data.refunds)}`
              : `支出 ${formatYen(data.expense)} ・ 差引 ${formatYen(data.income - data.expense)}`
          }
          icon={<Wallet size={18} />}
          tone="green"
        />
        <KpiCard
          label="日報売上 (値引後)"
          value={formatYen(data.reportedSales)}
          hint={
            data.reportedSales > 0 || data.netIncome > 0
              ? `決済との差異 ${delta >= 0 ? '+' : ''}${formatYen(delta)}`
              : '日報が未入力です'
          }
          icon={<FileBarChart2 size={18} />}
          tone="amber"
        />
        <KpiCard
          label="サブスク継続"
          value={data.activeSubs}
          hint="Square 連携 (アクティブ契約)"
          icon={<TrendingUp size={18} />}
          tone="rose"
        />
        <KpiCard
          label="契約率"
          value={`${data.contractRate}%`}
          hint={`新規${data.newCount}名 → 契約${data.contractCount}件`}
          icon={<Handshake size={18} />}
          tone="blue"
        />
      </div>

      {/* 売上の内訳 (決済ベース: サブスク / 回数券 / その他) + 会員数 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BreakdownCard
          label="サブスク売上"
          value={formatYen(data.subscriptionIncome)}
          icon={<CreditCard size={16} />}
          tone="bg-violet-50 text-violet-700"
        />
        <BreakdownCard
          label="回数券売上"
          value={formatYen(data.ticketIncome)}
          icon={<Ticket size={16} />}
          tone="bg-amber-50 text-amber-700"
        />
        <BreakdownCard
          label="単発・その他売上"
          value={formatYen(data.otherIncome)}
          icon={<Coins size={16} />}
          tone="bg-emerald-50 text-emerald-700"
        />
        <BreakdownCard
          label="総会員数"
          value={`${data.totalMembers}名 (アクティブ ${data.activeMembers})`}
          icon={<Users size={16} />}
          tone="bg-sky-50 text-sky-700"
        />
      </div>

      <p className="px-1 text-[11px] text-ink-400">
        決済ベース = Square 決済 + 出納帳の入金記録。日報売上との差異が大きい日は
        <Link href="/sales" className="mx-1 text-vivie-600 hover:underline">
          売上分析
        </Link>
        で日別に照合できます。
      </p>
    </div>
  );
}

function BreakdownCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="truncate font-serif text-lg font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
