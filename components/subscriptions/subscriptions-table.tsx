'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';
import { formatDate, formatYen, cn } from '@/lib/utils';

export type SubscriptionRow = {
  id: string;
  status: string;
  started_at: string | null;
  next_billing_at: string | null;
  cancelled_at: string | null;
  member: { id: string; full_name: string } | null;
  plan: { name: string; monthly_price: number } | null;
};

// Square のステータスを日本語ラベル + トーンに正規化
export function subStatusInfo(status: string): {
  label: string;
  tone: 'green' | 'red' | 'amber' | 'default';
  group: 'active' | 'cancelled' | 'paused' | 'other';
} {
  const s = (status ?? '').toUpperCase();
  if (s === 'ACTIVE') return { label: '継続中', tone: 'green', group: 'active' };
  if (s === 'CANCELED' || s === 'CANCELLED' || s === 'DEACTIVATED')
    return { label: '解約', tone: 'red', group: 'cancelled' };
  if (s === 'PAUSED') return { label: '一時停止', tone: 'amber', group: 'paused' };
  if (s === 'PENDING') return { label: '開始待ち', tone: 'amber', group: 'other' };
  return { label: status || '不明', tone: 'default', group: 'other' };
}

const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'active', label: '継続中' },
  { key: 'cancelled', label: '解約' },
  { key: 'paused', label: '一時停止' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export function SubscriptionsTable({ rows }: { rows: SubscriptionRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((r) => {
      if (filter !== 'all' && subStatusInfo(r.status).group !== filter) return false;
      if (q && !(r.member?.full_name ?? '').includes(q) && !(r.plan?.name ?? '').includes(q))
        return false;
      return true;
    });
  }, [rows, filter, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <div className="inline-flex rounded-xl border border-ink-100 bg-white p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.key ? 'bg-vivie-100 text-vivie-700' : 'text-ink-500 hover:bg-ink-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="会員名・プラン名で検索"
          className="field-input max-w-56 !py-1.5 text-xs"
        />
        <span className="ml-auto text-xs text-ink-400">{filtered.length} 件</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} />}
          title="該当するサブスク契約がありません"
          description="右上の「Square 同期」で最新の契約を取り込めます"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>会員</th>
                <th>プラン</th>
                <th className="text-right">金額</th>
                <th>ステータス</th>
                <th>開始</th>
                <th>次回課金</th>
                <th>解約日</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const info = subStatusInfo(s.status);
                return (
                  <tr key={s.id}>
                    <td>
                      {s.member ? (
                        <Link
                          href={`/members/${s.member.id}`}
                          className="font-medium text-ink-900 hover:text-vivie-600"
                        >
                          {s.member.full_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{s.plan?.name ?? '—'}</td>
                    <td className="text-right">{formatYen(s.plan?.monthly_price ?? 0)}</td>
                    <td>
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </td>
                    <td className="text-xs text-ink-500">{formatDate(s.started_at)}</td>
                    <td className="text-xs text-ink-500">
                      {info.group === 'active' ? formatDate(s.next_billing_at) : '—'}
                    </td>
                    <td className="text-xs text-ink-500">
                      {s.cancelled_at ? formatDate(s.cancelled_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
