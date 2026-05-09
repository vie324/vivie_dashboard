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
  rose: 'bg-vivie-100 text-vivie-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-sky-50 text-sky-700',
};

export function KpiCard({ label, value, delta, hint, icon, tone = 'default', className }: KpiCardProps) {
  return (
    <div className={cn('rounded-2xl border border-ink-100 bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="mt-2 truncate font-serif text-2xl font-semibold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        {icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', toneClass[tone])}>
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
