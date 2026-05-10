import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MessageThread } from '@/components/messages/message-thread';
import { ConversationMetaPanel } from '@/components/messages/conversation-meta-panel';
import { ChevronLeft, User, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { userId: string } }) {
  const supabase = createClient();
  const userId = decodeURIComponent(params.userId);

  const { data: conv } = await supabase
    .from('line_conversations')
    .select('*')
    .eq('line_user_id', userId)
    .maybeSingle();
  if (!conv) notFound();

  const [{ data: messages }, { data: meta }, { data: lastEvent }] = await Promise.all([
    supabase
      .from('line_messages')
      .select('*, sent_by_staff:staff!line_messages_sent_by_fkey(display_name)')
      .eq('line_user_id', userId)
      .order('sent_at', { ascending: true })
      .limit(500),
    supabase
      .from('line_conversation_meta')
      .select('*')
      .eq('line_user_id', userId)
      .maybeSingle(),
    supabase
      .from('line_events')
      .select('display_name')
      .eq('line_user_id', userId)
      .not('display_name', 'is', null)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let memberInfo: any = null;
  if ((conv as any).member_id) {
    const { data: m } = await supabase
      .from('members')
      .select('id, full_name, furigana, phone, status, primary_store:stores(name)')
      .eq('id', (conv as any).member_id)
      .maybeSingle();
    memberInfo = m;
  }

  const displayName =
    memberInfo?.full_name ??
    (conv as any).line_display_name ??
    (lastEvent as any)?.display_name ??
    '(名前未取得)';

  return (
    <div className="animate-fade-in-up">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
        >
          <ChevronLeft size={14} />
          会話一覧に戻る
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <MessageThread
          lineUserId={userId}
          memberId={(conv as any).member_id ?? null}
          conversationName={displayName}
          pictureUrl={(conv as any).line_picture_url ?? null}
          initialMessages={(messages ?? []) as any}
        />

        <aside className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-ink-500 mb-3">対応状況</p>
              <ConversationMetaPanel
                lineUserId={userId}
                memberId={(conv as any).member_id ?? null}
                initialStatus={((meta as any)?.status ?? 'open') as any}
                initialPinned={(meta as any)?.pinned ?? false}
                initialNotes={(meta as any)?.internal_notes ?? null}
                initialDisplayName={
                  memberInfo?.full_name ??
                  (conv as any).line_display_name ??
                  (lastEvent as any)?.display_name ??
                  null
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-ink-500">お客様情報</p>
              {memberInfo ? (
                <div className="space-y-2 text-sm">
                  <Link
                    href={`/members/${memberInfo.id}`}
                    className="block font-medium text-ink-900 hover:text-vivie-600"
                  >
                    {memberInfo.full_name}
                  </Link>
                  {memberInfo.furigana && (
                    <p className="text-xs text-ink-400">{memberInfo.furigana}</p>
                  )}
                  {memberInfo.phone && (
                    <p className="text-xs text-ink-600 inline-flex items-center gap-1">
                      <Phone size={12} className="text-ink-400" />
                      {memberInfo.phone}
                    </p>
                  )}
                  {memberInfo.primary_store?.name && (
                    <Badge tone="rose">{memberInfo.primary_store.name}</Badge>
                  )}
                  <Link
                    href={`/members/${memberInfo.id}`}
                    className="block mt-3 rounded-lg bg-ink-50 hover:bg-vivie-50 px-3 py-2 text-xs text-ink-700 text-center"
                  >
                    会員詳細を開く →
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                  <p className="font-medium mb-1">
                    <User size={12} className="inline -mt-0.5 mr-1" />
                    会員と紐付いていません
                  </p>
                  <p>
                    会員管理から該当のお客様を開き、「公式 LINE 連携」でこの ID を選択するとひも付きます。
                  </p>
                  <p className="mt-2 font-mono text-[10px] truncate text-amber-600">{userId}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
