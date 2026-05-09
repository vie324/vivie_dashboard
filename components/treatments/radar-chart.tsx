'use client';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { ScoreAxis, ScoreMap } from '@/lib/treatment-axes';

interface Props {
  axes: ScoreAxis[];
  current: ScoreMap;
  previous?: ScoreMap | null;
  height?: number;
}

export function ScoreRadar({ axes, current, previous, height = 280 }: Props) {
  const data = axes.map((a) => ({
    axis: a.label,
    current: Number(current[a.key]) || 0,
    previous: previous ? Number(previous[a.key]) || 0 : undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#E0DAD3" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: '#6B6359', fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
        {previous && (
          <Radar
            name="前回"
            dataKey="previous"
            stroke="#B6AFA4"
            fill="#B6AFA4"
            fillOpacity={0.2}
          />
        )}
        <Radar
          name="今回"
          dataKey="current"
          stroke="#C98785"
          fill="#DCA9A8"
          fillOpacity={0.4}
        />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}
