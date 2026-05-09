'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, LayoutGrid, List, Tag as TagIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatYen } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Member, MemberStatus } from '@/types/database';

interface MemberRow extends Member {
  primary_store?: { name: string } | null;
  subscriptions?: Array<{
    plan_id: string | null;
    status: string;
    plan?: { name: string } | null;
  }>;
  member_tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  stats?: {
    total_visits: number;
    last_visit_date: string | null;
    total_spend: number;
  } | null;
  line_picture_url?: string | null;
  line_display_name?: string | null;
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

const tagColorClass: Record<string, string> = {
  rose: 'bg-vivie-100 text-vivie-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
  red: 'bg-red-100 text-red-700',
};

export function MembersTable({ members }: { members: MemberRow[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'square' | 'manual'>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [view, setView] = useState<'card' | 'table'>('card');

  // 全タグを集める
  const allTags = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    members.forEach((m) =>
      m.member_tags?.forEach((mt) => map.set(mt.tag.id, { name: mt.tag.name, color: mt.tag.color })),
    );
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && m.source !== sourceFilter) return false;
      if (tagFilter && !m.member_tags?.some((mt) => mt.tag.id === tagFilter)) return false;
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.furigana ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [members, query, statusFilter, sourceFilter, tagFilter]);

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
          <div className="flex flex-wrap gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | MemberStatus)}
              className="min-w-[110px]"
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
              className="min-w-[110px]"
            >
              <option value="all">全ソース</option>
              <option value="square">Square</option>
              <option value="manual">手動</option>
            </Select>
            {allTags.length > 0 && (
              <Select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="min-w-[110px]"
              >
                <option value="">全タグ</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
              <button
                onClick={() => setView('card')}
                className={cn(
                  'rounded-lg p-1.5',
                  view === 'card' ? 'bg-vivie-100 text-vivie-700' : 'text-ink-400 hover:bg-ink-50',
                )}
                aria-label="カード"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('table')}
                className={cn(
                  'rounded-lg p-1.5',
                  view === 'table' ? 'bg-vivie-100 text-vivie-700' : 'text-ink-400 hover:bg-ink-50',
                )}
                aria-label="テーブル"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Filter size={24} />}
            title="該当する会員が見つかりませんでした"
            description={
              members.length === 0
                ? '右上の「新規登録」または「Square 同期」から会員を追加できます'
                : 'フィルタを変更してください'
            }
          />
        ) : view === 'card' ? (
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <MemberCard key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>会員</th>
                  <th>連絡先</th>
                  <th>ステータス</th>
                  <th>来店</th>
                  <th>累計</th>
                  <th>最終来店</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const stats = m.stats;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={m.full_name}
                            src={m.line_picture_url}
                            size="sm"
                          />
                          <div>
                            <Link
                              href={`/members/${m.id}`}
                              className="font-medium text-ink-900 hover:text-vivie-600"
                            >
                              {m.full_name}
                            </Link>
                            {m.furigana && (
                              <p className="text-xs text-ink-400">{m.furigana}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-ink-600">
                        {m.phone && <p>{m.phone}</p>}
                        {m.email && <p className="text-ink-400">{m.email}</p>}
                      </td>
                      <td>
                        <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
                      </td>
                      <td className="text-sm text-center">{stats?.total_visits ?? 0}</td>
                      <td className="text-sm text-right">{formatYen(stats?.total_spend ?? 0)}</td>
                      <td className="text-xs text-ink-500">
                        {stats?.last_visit_date ? formatDate(stats.last_visit_date) : '—'}
                      </td>
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

function MemberCard({ m }: { m: MemberRow }) {
  const activeSub = m.subscriptions?.find((s) => ['ACTIVE', 'active'].includes(s.status));
  const stats = m.stats;
  return (
    <Link
      href={`/members/${m.id}`}
      className="block rounded-2xl border border-ink-100 bg-white p-4 hover:border-vivie-200 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <Avatar name={m.full_name} src={m.line_picture_url} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-ink-900 truncate">{m.full_name}</p>
            <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
          </div>
          {m.furigana && <p className="text-xs text-ink-400 truncate">{m.furigana}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(m.member_tags ?? []).slice(0, 3).map((mt) => (
              <span
                key={mt.tag.id}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  tagColorClass[mt.tag.color] ?? tagColorClass.rose,
                )}
              >
                <TagIcon size={8} />
                {mt.tag.name}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="来店" value={`${stats?.total_visits ?? 0}回`} />
        <Stat label="累計" value={formatYen(stats?.total_spend ?? 0)} small />
        <Stat
          label="最終"
          value={stats?.last_visit_date ? formatDate(stats.last_visit_date).slice(5) : '—'}
        />
      </div>
      {activeSub?.plan?.name && (
        <p className="mt-3 text-xs text-vivie-700 bg-vivie-50/50 rounded-lg px-2 py-1 inline-block">
          {activeSub.plan.name}
        </p>
      )}
    </Link>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-ink-50/50 px-2 py-1.5">
      <p className="text-[10px] text-ink-400">{label}</p>
      <p className={cn('font-medium text-ink-900', small ? 'text-xs' : 'text-sm')}>{value}</p>
    </div>
  );
}
