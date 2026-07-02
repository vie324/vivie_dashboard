'use client';
import {
  Area,
  AreaChart,
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

export type ReconciliationPoint = {
  date: string; // YYYY-MM-DD
  settled: number; // 決済ベース (出納帳入金 − 返金)
  reported: number; // 日報売上 (値引後)
};

// 決済ベース売上とスタッフ日報売上を同一軸で日次比較する。
// 2 系列とも「円」なので単一 Y 軸 (二重軸は使わない)。
export function ReconciliationChart({ data }: { data: ReconciliationPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="settledGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_SERIES.rose} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_SERIES.rose} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={CHART_TICK}
          tickFormatter={(v: string) => v.slice(8)}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tick={CHART_TICK} tickFormatter={yenTick} width={52} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelFormatter={(v) => `${String(v).slice(5).replace('-', '/')} の売上`}
          formatter={(value: number, name: string) => [
            `¥${Number(value).toLocaleString('ja-JP')}`,
            name,
          ]}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="settled"
          name="決済ベース"
          stroke={CHART_SERIES.rose}
          strokeWidth={2}
          fill="url(#settledGrad)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="reported"
          name="日報 (値引後)"
          stroke={CHART_SERIES.gold}
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="none"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
