'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { TemplatePicker } from './template-picker';
import { Send, Loader2, Sparkles, Search, X as XIcon, Check, CheckCheck } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';

interface Message {
  id: string;
  line_user_id: string;
  member_id: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  message_text: string | null;
  sent_at: string;
  sent_by_staff?: { display_name: string } | null;
}

interface Props {
  lineUserId: string;
  memberId: string | null;
  conversationName: string;
  pictureUrl: string | null;
  initialMessages: Message[];
}

export function MessageThread({
  lineUserId,
  conversationName,
  pictureUrl,
  initialMessages,
}: Props) {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredMessages = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.message_text ?? '').toLowerCase().includes(q));
  })();

  // 未読数 (inbound + read_at が NULL のもの)
  const unreadCount = messages.filter(
    (m) => m.direction === 'inbound' && (m as any).read_at == null,
  ).length;
  const [marking, setMarking] = useState(false);

  async function markRead() {
    setMarking(true);
    try {
      await fetch('/api/line/mark-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId }),
      });
      setMessages((list) =>
        list.map((m) =>
          m.direction === 'inbound' && (m as any).read_at == null
            ? ({ ...m, read_at: new Date().toISOString() } as any)
            : m,
        ),
      );
      toast.show('既読にしました', 'success');
    } catch (err) {
      toast.show('既読化に失敗しました', 'error');
    } finally {
      setMarking(false);
    }
  }

  // 末尾までスクロール
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Realtime 購読
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`line-messages-${lineUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'line_messages',
          filter: `line_user_id=eq.${lineUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // 既に追加済みなら無視 (送信時にローカル追加するため)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [lineUserId]);

  async function send() {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setSending(true);
    setText('');
    try {
      const res = await fetch('/api/line/send-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId, text: body }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? '送信に失敗しました');
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === json.message.id)) return prev;
        return [...prev, json.message];
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '送信に失敗しました', 'error');
      setText(body); // 失敗時は内容を戻す
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter で送信
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white shadow-sm flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        {pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pictureUrl} alt="" className="h-10 w-10 rounded-full" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vivie-100 text-vivie-700 font-medium">
            {conversationName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-900 truncate">{conversationName}</p>
          <p className="text-xs text-ink-400">
            公式 LINE
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-vivie-100 px-1.5 py-0.5 text-[10px] font-medium text-vivie-700">
                未読 {unreadCount}
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markRead}
            disabled={marking}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-ink-700 hover:bg-vivie-50 hover:text-vivie-700"
            title="既読にする"
          >
            {marking ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            既読
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setSearchQuery('');
          }}
          className="rounded-lg p-2 text-ink-500 hover:bg-vivie-50 hover:text-vivie-600"
          aria-label="メッセージ検索"
        >
          {searchOpen ? <XIcon size={16} /> : <Search size={16} />}
        </button>
      </div>
      {searchOpen && (
        <div className="border-b border-ink-100 px-4 py-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メッセージ内を検索"
            autoFocus
          />
          {searchQuery && (
            <p className="mt-1 text-xs text-ink-500">
              {filteredMessages.length} 件のメッセージにヒット
            </p>
          )}
        </div>
      )}

      {/* スレッド */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-ink-50/40">
        {filteredMessages.length === 0 ? (
          <p className="text-center text-sm text-ink-400 py-12">
            {searchQuery ? '該当するメッセージがありません' : 'まだメッセージがありません。下から送信してください。'}
          </p>
        ) : (
          filteredMessages.map((m, i) => (
            <MessageBubble key={m.id} m={m} prev={filteredMessages[i - 1] ?? null} highlight={searchQuery} />
          ))
        )}
      </div>

      {/* 送信ボックス */}
      <div className="border-t border-ink-100 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <TemplatePicker
            memberName={conversationName}
            onPick={(t) => setText((cur) => (cur ? `${cur}\n${t}` : t))}
          />
        </div>
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="メッセージを入力 (Cmd/Ctrl + Enter で送信)"
            className="flex-1 min-h-[2.5rem] max-h-40"
            rows={1}
          />
          <Button onClick={send} disabled={!text.trim() || sending} size="md">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            送信
          </Button>
        </div>
      </div>
    </div>
  );
}

function highlightText(text: string, query?: string): React.ReactNode {
  if (!query?.trim()) return text;
  const q = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  while ((i = lowerText.indexOf(lowerQuery, lastIndex)) !== -1) {
    if (i > lastIndex) parts.push(text.slice(lastIndex, i));
    parts.push(
      <mark key={i} className="bg-amber-200 text-ink-900 rounded">
        {text.slice(i, i + q.length)}
      </mark>,
    );
    lastIndex = i + q.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MessageBubble({
  m,
  prev,
  highlight,
}: {
  m: Message;
  prev: Message | null;
  highlight?: string;
}) {
  const showTime =
    !prev ||
    new Date(m.sent_at).getTime() - new Date(prev.sent_at).getTime() > 5 * 60 * 1000;
  const isOutbound = m.direction === 'outbound';
  const isSystem = m.message_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white border border-ink-200 px-3 py-1 text-xs text-ink-500">
          <Sparkles size={10} />
          {m.message_text}
        </span>
      </div>
    );
  }

  return (
    <>
      {showTime && (
        <p className="text-center text-[10px] text-ink-400 my-2">
          {formatDateTime(m.sent_at)}
        </p>
      )}
      <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className={cn('max-w-[75%]', isOutbound && 'text-right')}>
          <div
            className={cn(
              'inline-block rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words text-left',
              isOutbound
                ? 'bg-vivie-300 text-white rounded-br-md'
                : 'bg-white border border-ink-100 text-ink-900 rounded-bl-md',
            )}
          >
            {highlightText(m.message_text ?? `(${m.message_type})`, highlight)}
          </div>
          {isOutbound && m.sent_by_staff && (
            <p className="mt-0.5 text-[10px] text-ink-400 mr-1">
              {m.sent_by_staff.display_name}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
