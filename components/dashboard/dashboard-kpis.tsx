'use client';
import { useState } from 'react';
import { PeriodTabs, periodRange, type PeriodKey } from './period-tabs';
import { KpiCard } from './kpi-card';
import { Users, TrendingUp, Wallet, FileBarChart2, Loader2, CreditCard, Ticket, Coins } from 'lucide-react';
import { formatYen } from '@/lib/utils';
import type { MetricsSummary } from '@/app/api/metrics/summary/route';

// 期間タブの切り替えで KPI を実際に再取得する。
// 以前はタブを押しても children が今月固定で再取得されず「数字が変わらない」状態だった。
export function DashboardKpis({ initial }: { initial: MetricsSummary }) {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [data, setData] = useState<MetricsSummary>(initial);
  const [loading, setLoading] = useState(false);

  async function changePeriod(p: PeriodKey) {
    setPeriod(p);
    setLoading(true);
    try {
      const { from, to } = periodRange(p);
      const res = await fetch(`/api/metrics/summary?from=${from}&to=${to}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ネットワークエラー時は直前の値を保持
    } finally {
      setLoading(false);
    }
  }

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
          label="総会員数"
          value={data.totalMembers}
          hint={`アクティブ ${data.activeMembers}名`}
          icon={<Users size={18} />}
          tone="rose"
        />
        <KpiCard
          label="サブスク継続"
          value={data.activeSubs}
          hint="Square 連携"
          icon={<TrendingUp size={18} />}
          tone="amber"
        />
        <KpiCard
          label="売上"
          value={formatYen(data.income)}
          hint={`支出 ${formatYen(data.expense)} ・ 差引 ${formatYen(data.income - data.expense)}`}
          icon={<Wallet size={18} />}
          tone="green"
        />
        <KpiCard
          label="リピート率"
          value={`${data.repeatRate}%`}
          hint={`既存${data.existing}件中 ${data.repeat}件`}
          icon={<FileBarChart2 size={18} />}
          tone="blue"
        />
      </div>

      {/* 売上の内訳 (サブスク / 回数券 / その他) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BreakdownCard
          label="サブスク売上"
          value={data.subscriptionIncome}
          icon={<CreditCard size={16} />}
          tone="bg-violet-50 text-violet-700"
        />
        <BreakdownCard
          label="回数券売上"
          value={data.ticketIncome}
          icon={<Ticket size={16} />}
          tone="bg-amber-50 text-amber-700"
        />
        <BreakdownCard
          label="単発・その他売上"
          value={data.otherIncome}
          icon={<Coins size={16} />}
          tone="bg-emerald-50 text-emerald-700"
        />
      </div>
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
  value: number;
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
        <p className="font-serif text-lg font-semibold text-ink-900">{formatYen(value)}</p>
      </div>
    </div>
  );
}
