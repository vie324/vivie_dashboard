'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { Member, MemberStatus } from '@/types/database';

interface MemberRow extends Member {
  primary_store?: { name: string } | null;
  subscriptions?: Array<{
    plan_id: string | null;
    status: string;
    plan?: { name: string } | null;
  }>;
}

const statusTone: Record<MemberStatus, 'green' | 'amber' | 'red' | 'blue'> = {
  active: 'green',
  paused: 'amber',
  cancelled: 'red',
  lead: 'blue',
};
const statusLabel: Record<MemberStatus, string> = {
  active: '在籍',
  paused: '休会',
  cancelled: '退会',
  lead: '見込',
};

export function MembersTable({ members }: { members: MemberRow[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'square' | 'manual'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && m.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.furigana ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [members, query, statusFilter, sourceFilter]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="氏名・フリガナ・電話・メールで検索"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | MemberStatus)}
              className="min-w-[120px]"
            >
              <option value="all">全ステータス</option>
              <option value="active">在籍</option>
              <option value="paused">休会</option>
              <option value="cancelled">退会</option>
              <option value="lead">見込</option>
            </Select>
            <Select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'square' | 'manual')}
              className="min-w-[120px]"
            >
              <option value="all">全ソース</option>
              <option value="square">Square</option>
              <option value="manual">手動</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Filter size={24} />}
            title="該当する会員が見つかりませんでした"
            description={members.length === 0 ? '右上の「新規登録」または「Square 同期」から会員を追加できます' : 'フィルタを変更してください'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>会員</th>
                  <th>連絡先</th>
                  <th>ステータス</th>
                  <th>プラン</th>
                  <th>店舗</th>
                  <th>登録日</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const activeSub = m.subscriptions?.find((s) =>
                    ['ACTIVE', 'active'].includes(s.status),
                  );
                  return (
                    <tr key={m.id}>
                      <td>
                        <Link
                          href={`/members/${m.id}`}
                          className="font-medium text-ink-900 hover:text-vivie-600"
                        >
                          {m.full_name}
                        </Link>
                        {m.furigana && (
                          <p className="text-xs text-ink-400">{m.furigana}</p>
                        )}
                      </td>
                      <td className="text-xs text-ink-600">
                        {m.phone && <p>{m.phone}</p>}
                        {m.email && <p className="text-ink-400">{m.email}</p>}
                      </td>
                      <td>
                        <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
                      </td>
                      <td className="text-sm">
                        {activeSub?.plan?.name ?? <span className="text-ink-300">—</span>}
                      </td>
                      <td className="text-sm text-ink-600">{m.primary_store?.name ?? '—'}</td>
                      <td className="text-xs text-ink-500">{formatDate(m.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
