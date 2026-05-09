'use client';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SKIN_AXES, FACE_AXES, BODY_AXES, avgScore } from '@/lib/treatment-axes';

interface T {
  treatment_date: string;
  skin_scores: any;
  face_scores: any;
  body_scores: any;
}

export function ScoreHistoryChart({ treatments }: { treatments: T[] }) {
  // 日付昇順に並び替え (古い → 新しい)
  const data = [...treatments].reverse().map((t) => ({
    date: t.treatment_date.slice(5),
    肌: avgScore(SKIN_AXES, t.skin_scores ?? {}),
    顔: avgScore(FACE_AXES, t.face_scores ?? {}),
    体: avgScore(BODY_AXES, t.body_scores ?? {}),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#EFEDE9" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B6359' }} />
        <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#6B6359' }} />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #EFEDE9',
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="肌" stroke="#C98785" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="顔" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="体" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
