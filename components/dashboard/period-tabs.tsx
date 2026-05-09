'use client';
import { cn } from '@/lib/utils';

const periods = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '今週' },
  { key: 'month', label: '今月' },
  { key: 'last_month', label: '先月' },
] as const;

export type PeriodKey = (typeof periods)[number]['key'];

export function PeriodTabs({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-ink-100 bg-white p-1 shadow-sm">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === p.key ? 'bg-vivie-100 text-vivie-700' : 'text-ink-500 hover:bg-ink-50',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function periodRange(p: PeriodKey): { from: string; to: string; label: string } {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  const ymd = (d: Date) => new Date(d.getTime() - tz).toISOString().slice(0, 10);

  if (p === 'today') {
    return { from: ymd(now), to: ymd(now), label: '今日' };
  }
  if (p === 'week') {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    return { from: ymd(start), to: ymd(now), label: '今週' };
  }
  if (p === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: ymd(start), to: ymd(end), label: '先月' };
  }
  // month (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: ymd(start), to: ymd(now), label: '今月' };
}
