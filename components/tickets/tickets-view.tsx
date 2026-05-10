'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Ticket, Search, AlertTriangle, CheckCheck, Clock } from 'lucide-react';
import { formatDate, formatYen } from '@/lib/utils';

type EffectiveStatus = 'active' | 'used_up' | 'expired' | 'refunded';

interface TicketRow {
  id: string;
  member_id: string;
  member_name: string | null;
  line_picture_url: string | null;
  plan_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  price: number;
  purchased_at: string;
  expires_at: string;
  days_until_expiry: number;
  effective_status: EffectiveStatus;
  store_name: string | null;
}

const statusLabel: Record<EffectiveStatus, string> = {
  active: '有効',
  used_up: '使い切り',
  expired: '期限切れ',
  refunded: '返金済',
};

const statusTone: Record<EffectiveStatus, 'green' | 'default' | 'amber' | 'red'> = {
  active: 'green',
  used_up: 'default',
  expired: 'amber',
  refunded: 'red',
};

interface Props {
  tickets: TicketRow[];
  plans: any[];
}

export function TicketsView({ tickets }: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EffectiveStatus | 'expiring_soon'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter === 'expiring_soon') {
        if (t.effective_status !== 'active') return false;
        if (t.days_until_expiry > 30) return false;
      } else if (statusFilter !== 'all' && t.effective_status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (t.member_name ?? '').toLowerCase().includes(q) ||
        t.plan_name.toLowerCase().includes(q)
      );
    });
  }, [tickets, query, statusFilter]);

  const stats = useMemo(() => {
    const active = tickets.filter((t) => t.effective_status === 'active');
    const expiringSoon = active.filter((t) => t.days_until_expiry <= 30);
    return {
      total: tickets.length,
      active: active.length,
      expiringSoon: expiringSoon.length,
      totalRemaining: active.reduce((s, t) => s + t.remaining_count, 0),
    };
  }, [tickets]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="総発行" value={stats.total} icon={<Ticket size={16} />} />
        <Stat label="有効中" value={stats.active} icon={<CheckCheck size={16} />} tone="green" />
        <Stat
          label="30日以内に期限"
          value={stats.expiringSoon}
          icon={<AlertTriangle size={16} />}
          tone="amber"
        />
        <Stat label="残回数 合計" value={stats.totalRemaining} icon={<Clock size={16} />} tone="rose" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="会員名・プラン名で検索"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-44"
            >
              <option value="all">全状態</option>
              <option value="active">有効中</option>
              <option value="expiring_soon">30日以内期限</option>
              <option value="used_up">使い切り</option>
              <option value="expired">期限切れ</option>
              <option value="refunded">返金済</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Ticket size={28} />}
              title="該当する回数券がありません"
              description="会員詳細ページから「回数券を発行」できます"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>会員</th>
                    <th>プラン</th>
                    <th className="text-right">残 / 計</th>
                    <th>進捗</th>
                    <th>期限</th>
                    <th>状態</th>
                    <th className="text-right">価格</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const usedPct = (t.used_count / t.total_count) * 100;
                    const expiringSoon = t.effective_status === 'active' && t.days_until_expiry <= 30;
                    return (
                      <tr key={t.id}>
                        <td>
                          <Link
                            href={`/members/${t.member_id}`}
                            className="flex items-center gap-2 font-medium hover:text-vivie-600"
                          >
                            <Avatar
                              name={t.member_name ?? '?'}
                              src={t.line_picture_url}
                              size="xs"
                            />
                            {t.member_name ?? '—'}
                          </Link>
                        </td>
                        <td className="text-sm">{t.plan_name}</td>
                        <td className="text-right font-medium">
                          {t.remaining_count} / {t.total_count}
                        </td>
                        <td className="w-32">
                          <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                            <div
                              className="h-full bg-vivie-400"
                              style={{ width: `${Math.min(100, usedPct)}%` }}
                            />
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-ink-500">{formatDate(t.expires_at)}</span>
                          {expiringSoon && (
                            <Badge tone="amber" className="ml-1.5 text-[10px]">
                              あと {Math.max(0, t.days_until_expiry)} 日
                            </Badge>
                          )}
                        </td>
                        <td>
                          <Badge tone={statusTone[t.effective_status]}>
                            {statusLabel[t.effective_status]}
                          </Badge>
                        </td>
                        <td className="text-right text-sm">{formatYen(t.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: 'default' | 'green' | 'amber' | 'rose';
}) {
  const toneClass = {
    default: 'text-ink-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-vivie-700',
  };
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">{label}</p>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <p className={`mt-1 font-serif text-2xl font-semibold ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}
