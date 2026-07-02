import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { formatYen } from '@/lib/utils';
import type { GoalProgress, GoalMetric } from '@/lib/goals';

function fmt(value: number, unit: GoalMetric['unit']): string {
  if (unit === 'yen') return formatYen(value);
  if (unit === 'percent') return `${value}%`;
  return value.toLocaleString('ja-JP');
}

function barTone(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-vivie-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-400';
}

export function GoalProgressCard({
  progress,
  title = '今月の目標達成状況',
  storeName,
  className,
}: {
  progress: GoalProgress;
  title?: string;
  storeName?: string | null;
  className?: string;
}) {
  const { month, goal, goalScope, metrics } = progress;
  const hasGoal = !!goal && metrics.some((m) => m.target > 0);

  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Target className="text-vivie-500" size={18} />
          {title}
          <span className="text-xs font-normal text-ink-400">{month}</span>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {storeName && (
            <span className="text-[10px] rounded-full bg-ink-100 text-ink-600 px-2 py-0.5">
              {storeName}
            </span>
          )}
          {goalScope === 'all' && (
            <span className="text-[10px] rounded-full bg-vivie-50 text-vivie-700 px-2 py-0.5">
              全店舗目標
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {!hasGoal && (
          <p className="rounded-xl bg-ink-50/60 px-3 py-2 text-xs text-ink-500">
            今月の目標は未設定です。管理ページ &gt; 目標管理 から設定できます。下記は現時点の実績です。
          </p>
        )}
        {metrics.map((m) => (
          <MetricRow key={m.key} metric={m} />
        ))}
      </CardContent>
    </Card>
  );
}

function MetricRow({ metric }: { metric: GoalMetric }) {
  const { label, actual, target, unit } = metric;
  const hasTarget = target > 0;
  const ratio = hasTarget ? actual / target : 0;
  const pct = hasTarget ? Math.round(ratio * 100) : 0;
  const barWidth = Math.min(100, ratio * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-600">{label}</span>
        <span className="font-medium text-ink-900">
          {fmt(actual, unit)}
          {hasTarget && (
            <span className="font-normal text-ink-400"> / {fmt(target, unit)}</span>
          )}
          {hasTarget && (
            <span
              className={`ml-2 text-xs font-semibold ${
                pct >= 100 ? 'text-emerald-600' : 'text-ink-500'
              }`}
            >
              {pct}%
            </span>
          )}
          {!hasTarget && <span className="ml-2 text-[10px] text-ink-300">参考値</span>}
        </span>
      </div>
      {/* 目標未設定の指標は空のバーを出さない (未達成に見えてしまうため) */}
      {hasTarget && (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
          <div
            className={`h-full rounded-full transition-all animate-bar-grow ${barTone(pct)}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  );
}
