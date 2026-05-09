'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, MessageCircle, ChevronRight } from 'lucide-react';
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
}

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.member_name ?? '').toLowerCase().includes(q) ||
        (c.line_display_name ?? '').toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-ink-100 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {conversations.length} 件の会話
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-vivie-500 px-2 py-0.5 text-xs font-medium text-white">
                未読 {totalUnread}
              </span>
            )}
          </p>
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

        <ul className="divide-y divide-ink-100">
          {filtered.map((c) => (
            <ConversationItem key={c.line_user_id} c={c} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ConversationItem({ c }: { c: Conversation }) {
  const name = c.member_name ?? c.line_display_name ?? '(名前未取得)';
  const initials = name.slice(0, 1);
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
            <p className="font-medium text-ink-900 truncate">
              {name}
              {isUnlinked && (
                <span className="ml-2 rounded-md bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
                  未連携
                </span>
              )}
            </p>
            <span className="text-xs text-ink-400 shrink-0">
              {formatDateTime(c.last_sent_at)}
            </span>
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
