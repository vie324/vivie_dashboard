'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  LabelList,
} from 'recharts';

export type RepeatBar = { name: string; rate: number; existing: number; repeat: number };

function barColor(rate: number): string {
  if (rate >= 60) return '#10B981'; // emerald
  if (rate >= 40) return '#F59E0B'; // amber
  return '#DCA9A8'; // vivie rose
}

// スタッフ別 / 媒体別のリピート率を横棒で可視化する。
export function RepeatBarChart({ data }: { data: RepeatBar[] }) {
  if (data.length === 0) return null;
  const height = Math.max(120, data.length * 44);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
        barCategoryGap={12}
      >
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tick={{ fontSize: 12, fill: '#6b6b6b' }}
          tickLine={false}
          axisLine={false}
        />
        <ReTooltip
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #eee' }}
          formatter={(v: any, _n: any, p: any) => [
            `${v}% (リピート ${p.payload.repeat} / 既存 ${p.payload.existing})`,
            'リピート率',
          ]}
        />
        <Bar dataKey="rate" radius={[6, 6, 6, 6]} isAnimationActive animationDuration={600}>
          {data.map((d, i) => (
            <Cell key={i} fill={barColor(d.rate)} />
          ))}
          <LabelList
            dataKey="rate"
            position="right"
            formatter={(v: any) => `${v}%`}
            style={{ fontSize: 12, fontWeight: 600, fill: '#3f3f3f' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
