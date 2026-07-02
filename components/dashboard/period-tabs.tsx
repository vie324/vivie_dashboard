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

// サロンは JST 運用のため、閲覧者のタイムゾーンに関わらず日本時間の暦日で期間を切る
// (entry_date / report_date は JST 暦日で保存されている)。
export function periodRange(p: PeriodKey): { from: string; to: string; label: string } {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  // JST の壁時計をそのまま UTC フィールドとして持つ Date (getUTC* で JST の値が取れる)
  const jstNow = new Date(Date.now() + JST_OFFSET_MS);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  if (p === 'today') {
    return { from: ymd(jstNow), to: ymd(jstNow), label: '今日' };
  }
  if (p === 'week') {
    const start = new Date(jstNow);
    // 月曜始まり (日本のビジネス週)
    const day = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - day);
    return { from: ymd(start), to: ymd(jstNow), label: '今週' };
  }
  if (p === 'last_month') {
    const start = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 0));
    return { from: ymd(start), to: ymd(end), label: '先月' };
  }
  // month (default)
  const start = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1));
  return { from: ymd(start), to: ymd(jstNow), label: '今月' };
}
