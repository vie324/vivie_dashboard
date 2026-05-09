import Link from 'next/link';
import {
  ClipboardList,
  Activity,
  CalendarRange,
  MessageCircle,
  CreditCard,
} from 'lucide-react';
import { formatDate, formatDateTime, formatYen } from '@/lib/utils';

interface Event {
  type: 'visit' | 'treatment' | 'counseling' | 'subscription' | 'message';
  date: string;
  title: string;
  meta?: string;
  amount?: number | null;
  href?: string;
}

const config = {
  visit: { icon: CalendarRange, color: 'bg-sky-100 text-sky-700' },
  treatment: { icon: Activity, color: 'bg-vivie-100 text-vivie-700' },
  counseling: { icon: ClipboardList, color: 'bg-amber-100 text-amber-700' },
  subscription: { icon: CreditCard, color: 'bg-emerald-100 text-emerald-700' },
  message: { icon: MessageCircle, color: 'bg-violet-100 text-violet-700' },
};

export function MemberTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-400 py-8 text-center">まだ履歴がありません</p>;
  }

  return (
    <ol className="relative space-y-3">
      <span className="absolute left-4 top-2 bottom-2 w-px bg-ink-100" aria-hidden />
      {events.map((ev, i) => {
        const cfg = config[ev.type];
        const Icon = cfg.icon;
        const inner = (
          <>
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.color}`}
            >
              <Icon size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                <span className="text-xs text-ink-400 shrink-0">{formatDate(ev.date)}</span>
              </div>
              {ev.meta && <p className="text-xs text-ink-500 mt-0.5">{ev.meta}</p>}
              {ev.amount != null && (
                <p className="text-xs text-ink-700 mt-0.5">{formatYen(ev.amount)}</p>
              )}
            </div>
          </>
        );
        return (
          <li key={i} className="flex items-start gap-3">
            {ev.href ? (
              <Link href={ev.href} className="flex flex-1 items-start gap-3 hover:bg-vivie-50/40 rounded-lg p-1 -m-1">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
