'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_SERIES,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  yenTick,
} from '@/lib/chart-theme';

export type MovementPoint = {
  month: string; // YYYY-MM
  newCount: number;
  cancelledCount: number;
};

export type SubRevenuePoint = {
  month: string; // YYYY-MM
  revenue: number; // 実績サブスク売上 (返金控除後)
};

// 新規契約 vs 解約 (件数) — 12 ヶ月
export function SubscriptionMovementChart({ data }: { data: MovementPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tick={CHART_TICK}
          tickFormatter={(v: string) => v.slice(5).replace(/^0/, '') + '月'}
          minTickGap={8}
        />
        <YAxis tick={CHART_TICK} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelFormatter={(v) => `${String(v).replace('-', '年')}月`}
          formatter={(value: number, name: string) => [`${value} 件`, name]}
          cursor={{ fill: 'rgba(31,27,22,0.04)' }}
        />
        <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="newCount"
          name="新規契約"
          fill={CHART_SERIES.teal}
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
        />
        <Bar
          dataKey="cancelledCount"
          name="解約"
          fill={CHART_SERIES.rose}
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 月次サブスク売上実績 (出納帳ベース・返金控除後) — 12 ヶ月
export function SubscriptionRevenueChart({ data }: { data: SubRevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tick={CHART_TICK}
          tickFormatter={(v: string) => v.slice(5).replace(/^0/, '') + '月'}
          minTickGap={8}
        />
        <YAxis tick={CHART_TICK} tickFormatter={yenTick} width={52} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelFormatter={(v) => `${String(v).replace('-', '年')}月のサブスク売上`}
          formatter={(value: number) => [`¥${Number(value).toLocaleString('ja-JP')}`, '実績']}
          cursor={{ fill: 'rgba(31,27,22,0.04)' }}
        />
        <Bar dataKey="revenue" name="サブスク売上 (実績)" fill={CHART_SERIES.gold} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
