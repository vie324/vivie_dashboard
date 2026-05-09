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

interface Point {
  date: string;
  income?: number;
  visits?: number;
  new_visits?: number;
  repeat_visits?: number;
}

export function TrendChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#DCA9A8" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#DCA9A8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#EFEDE9" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B6359' }} tickFormatter={(v) => v.slice(5)} />
        <YAxis
          tick={{ fontSize: 10, fill: '#6B6359' }}
          tickFormatter={(v) => (v >= 1000 ? `¥${Math.round(v / 1000)}k` : `¥${v}`)}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #EFEDE9',
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(v: number) => `¥${v.toLocaleString('ja-JP')}`}
        />
        <Area
          type="monotone"
          dataKey="income"
          name="売上"
          stroke="#C98785"
          strokeWidth={2}
          fill="url(#incomeGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
