import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type LucideIcon,
  Users,
  ClipboardList,
  Activity,
  Scan,
  Ticket,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { GoalProgressCard } from '@/components/dashboard/goal-progress-card';
import type { GoalProgress } from '@/lib/goals';
import type { Staff } from '@/types/database';

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: 'rose' | 'amber' | 'blue' | 'green' | 'violet';
};

const quickActions: QuickAction[] = [
  {
    href: '/members',
    label: '会員',
    description: '会員検索・新規登録',
    icon: Users,
    tone: 'rose',
  },
  {
    href: '/counseling/new',
    label: 'カウンセリング',
    description: '初回お客様の登録',
    icon: ClipboardList,
    tone: 'blue',
  },
  {
    href: '/treatments/new',
    label: '施術レポート',
    description: '施術完了後の入力',
    icon: Activity,
    tone: 'green',
  },
  {
    href: '/skin-analysis',
    label: '肌分析',
    description: '肌チェックの記録',
    icon: Scan,
    tone: 'violet',
  },
  {
    href: '/tickets',
    label: '回数券',
    description: '回数券の使用記録',
    icon: Ticket,
    tone: 'amber',
  },
];

const toneClass: Record<QuickAction['tone'], string> = {
  rose: 'bg-vivie-100 text-vivie-600',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
};

export function StoreHome({
  staff,
  expiringTickets,
  goalProgress,
}: {
  staff: Staff;
  expiringTickets: any[];
  goalProgress?: GoalProgress;
}) {
  const now = new Date();
  const todayLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <div className="space-y-6 stagger-children">
      <div className="relative overflow-hidden rounded-3xl border border-ink-100 bg-white p-6 shadow-soft md:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-100/60 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-vivie-100/70 blur-2xl"
          aria-hidden
        />
        <p className="text-xs font-medium tracking-wide text-ink-500">{todayLabel}</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900 md:text-3xl">
          いらっしゃいませ {staff.display_name}
        </h1>
        <span className="gold-rule mt-3" aria-hidden />
        <p className="mt-2 text-sm text-ink-500">今日も一日よろしくお願いします</p>
      </div>

      {goalProgress && <GoalProgressCard progress={goalProgress} />}

      <section>
        <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
          クイックメニュー
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition-all hover:border-vivie-200 hover:shadow-md md:p-5"
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneClass[action.tone]} md:h-14 md:w-14`}
                >
                  <Icon size={22} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-base font-semibold text-ink-900 md:text-lg">
                    {action.label}
                  </p>
                  <p className="text-xs text-ink-500 truncate">{action.description}</p>
                </div>
                <ChevronRight size={18} className="text-ink-300 group-hover:text-vivie-500" />
              </Link>
            );
          })}
        </div>
      </section>

      {expiringTickets.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="text-amber-600" size={18} />
              30日以内に期限切れの回数券 ({expiringTickets.length} 件)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-amber-200">
              {expiringTickets.map((t: any) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Link
                    href={`/members/${t.member_id}`}
                    className="flex-1 font-medium hover:text-vivie-600 truncate"
                  >
                    {t.member_name ?? '—'}
                  </Link>
                  <span className="text-xs text-ink-600">{t.plan_name}</span>
                  <span className="text-xs text-ink-500">
                    残 {t.remaining_count}/{t.total_count}
                  </span>
                  <span className="text-xs font-medium text-amber-700">
                    {formatDate(t.expires_at)} (あと {Math.max(0, t.days_until_expiry)}日)
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
