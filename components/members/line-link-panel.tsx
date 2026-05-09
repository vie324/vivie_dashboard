'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Link2, Unlink, MessageCircle, Search, Save } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface LineEvent {
  id: string;
  event_type: string;
  line_user_id: string | null;
  display_name: string | null;
  picture_url: string | null;
  message_text: string | null;
  received_at: string;
  member_id: string | null;
}

interface Props {
  memberId: string;
  memberName: string;
  currentLineUserId: string | null;
  currentLineDisplayName: string | null;
}

export function LineLinkPanel({
  memberId,
  memberName,
  currentLineUserId,
  currentLineDisplayName,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [events, setEvents] = useState<LineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualUserId, setManualUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('line_events')
      .select('*')
      .is('member_id', null)
      .not('line_user_id', 'is', null)
      .order('received_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setEvents((data ?? []) as any);
        setLoading(false);
      });
  }, []);

  async function linkUser(lineUserId: string, displayName?: string | null, pictureUrl?: string | null) {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('members')
        .update({
          line_user_id: lineUserId,
          line_display_name: displayName ?? currentLineDisplayName,
          line_picture_url: pictureUrl ?? null,
        })
        .eq('id', memberId);
      if (error) throw error;

      // 過去の line_events も紐付け
      await supabase
        .from('line_events')
        .update({ member_id: memberId })
        .eq('line_user_id', lineUserId)
        .is('member_id', null);

      toast.show(`${memberName} 様と LINE を連携しました`, 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '連携に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function unlink() {
    if (!confirm('LINE 連携を解除しますか?')) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('members')
        .update({
          line_user_id: null,
          line_display_name: null,
          line_picture_url: null,
        })
        .eq('id', memberId);
      if (error) throw error;
      toast.show('連携を解除しました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '解除に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="text-vivie-500" size={18} />
          公式 LINE 連携
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentLineUserId ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <Badge tone="green" className="mb-1">連携済み</Badge>
                <p className="text-sm font-medium">
                  {currentLineDisplayName ?? '(LINE 表示名なし)'}
                </p>
                <p className="text-xs text-ink-400 font-mono mt-0.5 break-all">
                  {currentLineUserId}
                </p>
              </div>
              <Button onClick={unlink} variant="ghost" size="sm" disabled={submitting}>
                <Unlink size={14} />
                解除
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-ink-50/40 px-3 py-2 text-xs text-ink-600">
              お客様が公式 LINE を友だち追加すると、ここに userId 候補が表示されます。
              該当のお客様をクリックして連携してください。
            </div>

            {/* 手動入力 */}
            <div className="rounded-xl border border-ink-100 p-3">
              <p className="text-xs font-medium text-ink-700 mb-2">手動で userId を入力</p>
              <div className="flex gap-2">
                <Input
                  value={manualUserId}
                  onChange={(e) => setManualUserId(e.target.value)}
                  placeholder="U..."
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!manualUserId || submitting}
                  onClick={() => linkUser(manualUserId.trim())}
                >
                  <Save size={14} />
                  保存
                </Button>
              </div>
            </div>

            {/* 候補リスト */}
            <div>
              <p className="text-xs font-medium text-ink-700 mb-2">
                <Search size={12} className="inline -mt-0.5 mr-1" />
                未連携の友だち候補 (直近 30 件)
              </p>
              {loading ? (
                <p className="text-xs text-ink-400 text-center py-3">読み込み中…</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-3">
                  友だち追加されたお客様がまだいません。LINE Webhook が動作しているか確認してください。
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => ev.line_user_id && linkUser(ev.line_user_id, ev.display_name, ev.picture_url)}
                      disabled={submitting}
                      className="block w-full text-left rounded-lg border border-ink-100 px-3 py-2 hover:bg-vivie-50/40 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        {ev.picture_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={ev.picture_url}
                            alt=""
                            className="h-7 w-7 rounded-full"
                          />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-ink-400 text-xs">
                            ?
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {ev.display_name ?? '(名前未取得)'}
                          </p>
                          <p className="text-xs text-ink-400">
                            {ev.event_type} ・ {formatDateTime(ev.received_at)}
                          </p>
                          {ev.message_text && (
                            <p className="text-xs text-ink-500 truncate mt-0.5">
                              💬 {ev.message_text}
                            </p>
                          )}
                        </div>
                        <Link2 size={14} className="text-ink-300 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
