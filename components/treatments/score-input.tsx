'use client';
import { cn } from '@/lib/utils';
import type { ScoreAxis, ScoreMap } from '@/lib/treatment-axes';

interface Props {
  axes: ScoreAxis[];
  values: ScoreMap;
  onChange: (next: ScoreMap) => void;
}

export function ScoreInput({ axes, values, onChange }: Props) {
  function setScore(key: string, value: number) {
    onChange({ ...values, [key]: value });
  }
  return (
    <div className="space-y-3">
      {axes.map((axis) => {
        const v = Number(values[axis.key]) || 0;
        return (
          <div key={axis.key} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-ink-900">{axis.label}</p>
                {axis.description && (
                  <p className="text-xs text-ink-400">{axis.description}</p>
                )}
              </div>
              <span className="font-serif text-lg font-semibold text-vivie-600">{v}</span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(axis.key, n)}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-sm font-medium transition-colors',
                    v === n
                      ? 'bg-vivie-400 text-white'
                      : 'bg-white border border-ink-200 text-ink-500 hover:bg-vivie-50',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
