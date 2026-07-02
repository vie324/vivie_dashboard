import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string };
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'rose' | 'amber' | 'green' | 'blue' | 'default';
  className?: string;
}

const toneClass: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-ink-100 text-ink-700',
  rose: 'bg-gradient-to-br from-vivie-100 to-vivie-200/70 text-vivie-700',
  amber: 'bg-gradient-to-br from-gold-100 to-gold-200/70 text-gold-700',
  green: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700',
  blue: 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-700',
};

// 上辺のアクセントライン (トーン別)
const accentClass: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'from-ink-200 to-transparent',
  rose: 'from-vivie-300 to-transparent',
  amber: 'from-gold-400 to-transparent',
  green: 'from-emerald-300 to-transparent',
  blue: 'from-sky-300 to-transparent',
};

export function KpiCard({ label, value, delta, hint, icon, tone = 'default', className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-soft',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift hover:border-vivie-200',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-70',
          accentClass[tone],
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 truncate font-serif text-2xl font-semibold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
              'transition-transform duration-300 group-hover:scale-110',
              toneClass[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {delta && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
              delta.value >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {delta.value >= 0 ? '+' : ''}
            {delta.value}%
          </span>
          {delta.label && <span className="text-ink-400">{delta.label}</span>}
        </div>
      )}
    </div>
  );
}
