'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight, Pin, Inbox, CheckCheck, Archive } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';

interface Conversation {
  line_user_id: string;
  member_id: string | null;
  member_name: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  last_message: string | null;
  last_message_type: string;
  last_direction: string;
  last_sent_at: string;
  unread_count: number;
  status?: 'open' | 'handled' | 'archived';
  pinned?: boolean;
}

type FilterKey = 'all' | 'unread' | 'open' | 'handled' | 'archived' | 'unlinked';

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = conversations.filter((c) => {
      if (filter === 'unread' && c.unread_count === 0) return false;
      if (filter === 'open' && c.status !== 'open' && c.status !== undefined) return false;
      if (filter === 'open' && c.status === undefined && c.status !== undefined) return false;
      if (filter === 'handled' && c.status !== 'handled') return false;
      if (filter === 'archived' && c.status !== 'archived') return false;
      if (filter === 'unlinked' && c.member_id) return false;
      // archived は通常の表示から除外 (archived タブだけで見える)
      if (filter !== 'archived' && c.status === 'archived') return false;
      if (!q) return true;
      return (
        (c.member_name ?? '').toLowerCase().includes(q) ||
        (c.line_display_name ?? '').toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q)
      );
    });
    // ピン留め優先で並び替え
    items.sort((a, b) => {
      if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) return b.pinned ? 1 : -1;
      return b.last_sent_at.localeCompare(a.last_sent_at);
    });
    return items;
  }, [conversations, query, filter]);

  const counts = useMemo(() => {
    const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);
    const open = conversations.filter((c) => (c.status ?? 'open') === 'open' && c.status !== 'archived').length;
    const handled = conversations.filter((c) => c.status === 'handled').length;
    const archived = conversations.filter((c) => c.status === 'archived').length;
    const unlinked = conversations.filter((c) => !c.member_id && c.status !== 'archived').length;
    return {
      all: conversations.filter((c) => c.status !== 'archived').length,
      unread: totalUnread,
      open,
      handled,
      archived,
      unlinked,
    };
  }, [conversations]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-ink-100 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs filter={filter} setFilter={setFilter} counts={counts} />
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・メッセージで検索"
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-ink-400 py-10">
            該当する会話がありません
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {filtered.map((c) => (
              <ConversationItem key={c.line_user_id} c={c} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilterTabs({
  filter,
  setFilter,
  counts,
}: {
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  counts: any;
}) {
  const tabs: { key: FilterKey; label: string; icon: any; count: number; tone?: string }[] = [
    { key: 'all', label: '全て', icon: Inbox, count: counts.all },
    { key: 'unread', label: '未読', icon: Search, count: counts.unread, tone: 'rose' },
    { key: 'open', label: '対応中', icon: Inbox, count: counts.open, tone: 'amber' },
    { key: 'handled', label: '対応済', icon: CheckCheck, count: counts.handled, tone: 'green' },
    { key: 'unlinked', label: '未連携', icon: Search, count: counts.unlinked },
    { key: 'archived', label: 'アーカイブ', icon: Archive, count: counts.archived },
  ];
  return (
    <div className="flex flex-wrap gap-1 -m-0.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setFilter(t.key)}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
            filter === t.key
              ? t.tone === 'rose'
                ? 'bg-vivie-100 text-vivie-700'
                : t.tone === 'amber'
                  ? 'bg-amber-100 text-amber-700'
                  : t.tone === 'green'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-ink-200 text-ink-900'
              : 'text-ink-500 hover:bg-ink-50',
          )}
        >
          {t.label}
          {t.count > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white/60 px-1 text-[10px]">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ConversationItem({ c }: { c: Conversation }) {
  const fallbackName = `LINE …${c.line_user_id.slice(-6)}`;
  const name = c.member_name ?? c.line_display_name ?? fallbackName;
  const hasRealName = !!(c.member_name || c.line_display_name);
  const initials = (c.member_name ?? c.line_display_name ?? '?').slice(0, 1);
  const isUnlinked = !c.member_id;

  return (
    <Link
      href={`/messages/${c.line_user_id}`}
      className="block px-4 py-3 hover:bg-vivie-50/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        {c.line_picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.line_picture_url} alt="" className="h-11 w-11 rounded-full shrink-0" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vivie-100 text-vivie-700 font-medium">
            {initials}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-ink-900 truncate flex items-center gap-1.5">
              {c.pinned && <Pin size={11} className="text-vivie-500 shrink-0" />}
              <span className={hasRealName ? '' : 'font-mono text-xs text-ink-400'}>
                {name}
              </span>
              {isUnlinked && (
                <span className="rounded-md bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                  未連携
                </span>
              )}
              {c.status === 'handled' && (
                <span className="rounded-md bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                  対応済
                </span>
              )}
            </p>
            <span className="text-xs text-ink-400 shrink-0">{formatDateTime(c.last_sent_at)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p
              className={cn(
                'text-sm truncate flex-1',
                c.unread_count > 0 ? 'text-ink-900 font-medium' : 'text-ink-500',
              )}
            >
              {c.last_direction === 'outbound' && (
                <span className="text-ink-400">あなた: </span>
              )}
              {c.last_message_type === 'system' ? (
                <span className="italic">{c.last_message}</span>
              ) : (
                c.last_message ?? '—'
              )}
            </p>
            {c.unread_count > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-vivie-500 px-1.5 min-w-[1.25rem] h-5 text-xs font-medium text-white">
                {c.unread_count}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="text-ink-300 shrink-0" />
      </div>
    </Link>
  );
}
