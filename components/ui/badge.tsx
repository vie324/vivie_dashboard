import { cn } from '@/lib/utils';

type Tone = 'default' | 'rose' | 'green' | 'amber' | 'red' | 'blue';

const toneClass: Record<Tone, string> = {
  default: 'bg-ink-100 text-ink-700',
  rose: 'bg-vivie-100 text-vivie-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-sky-50 text-sky-700',
};

export function Badge({
  tone = 'default',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
