import { cn } from '@/lib/utils';

interface Props {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-lg',
};

const palette = [
  'bg-vivie-100 text-vivie-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ name, src, size = 'md', className }: Props) {
  const initials = name?.trim().slice(0, 1) || '?';
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover shrink-0', sizeClass[size], className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full font-medium shrink-0',
        sizeClass[size],
        colorFor(name),
        className,
      )}
      aria-label={name}
    >
      {initials}
    </span>
  );
}
