'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
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

interface Point {
  date: string;
  income?: number;
}

export function TrendChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_SERIES.rose} stopOpacity={0.4} />
            <stop offset="95%" stopColor={CHART_SERIES.rose} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={CHART_TICK}
          tickFormatter={(v) => v.slice(5)}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tick={CHART_TICK} tickFormatter={yenTick} width={52} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v: number) => [`¥${v.toLocaleString('ja-JP')}`, '売上']}
          labelFormatter={(v) => String(v).slice(5).replace('-', '/')}
        />
        <Area
          type="monotone"
          dataKey="income"
          name="売上"
          stroke={CHART_SERIES.rose}
          strokeWidth={2}
          fill="url(#incomeGrad)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
