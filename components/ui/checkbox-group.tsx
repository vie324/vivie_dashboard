'use client';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CheckboxGroupProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: 1 | 2 | 3;
}

export function CheckboxGroup({ options, value, onChange, columns = 2 }: CheckboxGroupProps) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      )}
    >
      {options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm text-left transition-all',
              checked
                ? 'border-vivie-300 bg-vivie-50/60 text-vivie-700'
                : 'border-ink-200 bg-white hover:bg-ink-50',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md border',
                checked ? 'bg-vivie-400 border-vivie-400 text-white' : 'border-ink-300 bg-white',
              )}
            >
              {checked && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="flex-1">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface RadioGroupProps {
  options: Option[];
  value: string | null;
  onChange: (next: string) => void;
  columns?: 1 | 2 | 3;
}

export function RadioGroup({ options, value, onChange, columns = 2 }: RadioGroupProps) {
  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      )}
    >
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm text-left transition-all',
              checked
                ? 'border-vivie-300 bg-vivie-50/60 text-vivie-700'
                : 'border-ink-200 bg-white hover:bg-ink-50',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border',
                checked ? 'border-vivie-400' : 'border-ink-300',
              )}
            >
              {checked && <span className="h-2.5 w-2.5 rounded-full bg-vivie-400" />}
            </span>
            <span className="flex-1">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
