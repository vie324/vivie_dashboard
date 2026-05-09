'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { MessageCircle, Send, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { formatDateTime, formatYen, formatDate } from '@/lib/utils';

interface Props {
  reportId: string;
  isFirstVisit: boolean;
  contracted: boolean;
  followupOffer: any | null;
  lineSentAt: string | null;
  lineSendError: string | null;
  memberName: string;
  memberId: string;
  memberLineUserId: string | null;
  memberLineDisplayName: string | null;
}

export function LineFollowupPanel({
  reportId,
  isFirstVisit,
  contracted,
  followupOffer,
  lineSentAt,
  lineSendError,
  memberName,
  memberId,
  memberLineUserId,
  memberLineDisplayName,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  // 送信対象でない場合は控えめに表示
  if (!isFirstVisit && !lineSentAt) return null;
  if (contracted && !lineSentAt) return null;

  async function send() {
    if (!confirm(`${memberName} 様に LINE でフォローアップメッセージを送信しますか?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/line/send-followup/${reportId}`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '送信に失敗しました');
      toast.show('LINE 送信しました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '送信に失敗しました', 'error');
    } finally {
      setSending(false);
    }
  }

  const canSend = isFirstVisit && !contracted && memberLineUserId && followupOffer;

  return (
    <Card className="border-vivie-200 bg-gradient-to-br from-vivie-50/40 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="text-vivie-500" size={20} />
          フォローアップ LINE
        </CardTitle>
        <p className="mt-1 text-xs text-ink-500">
          初回未契約のお客様に「本日の成果 + 1 回限定特別オファー」を送信します
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ステータス */}
        <div className="flex flex-wrap gap-2">
          <Badge tone={isFirstVisit ? 'rose' : 'default'}>
            {isFirstVisit ? '初回来店' : '既存顧客'}
          </Badge>
          <Badge tone={contracted ? 'green' : 'amber'}>
            {contracted ? '契約成立' : '未契約'}
          </Badge>
          {memberLineUserId ? (
            <Badge tone="green">LINE 連携済</Badge>
          ) : (
            <Badge tone="amber">LINE 未連携</Badge>
          )}
          {lineSentAt && (
            <Badge tone="green">
              <CheckCircle2 size={10} className="mr-0.5" />
              送信済 {formatDateTime(lineSentAt)}
            </Badge>
          )}
        </div>

        {/* オファー内容 */}
        {followupOffer ? (
          <div className="rounded-xl border border-vivie-200 bg-white p-4">
            <p className="text-xs font-medium text-vivie-700 mb-2">送信予定のオファー</p>
            <div className="space-y-1.5 text-sm">
              {followupOffer.menu && (
                <p>
                  <span className="text-ink-500">メニュー:</span>{' '}
                  <strong>{followupOffer.menu}</strong>
                </p>
              )}
              {followupOffer.original_price && followupOffer.discounted_price && (
                <p>
                  <span className="text-ink-500">価格:</span>{' '}
                  <span className="text-ink-400 line-through">{formatYen(followupOffer.original_price)}</span>
                  {' → '}
                  <strong className="text-vivie-600">{formatYen(followupOffer.discounted_price)}</strong>
                  {followupOffer.discount_label && (
                    <span className="ml-2 text-xs text-vivie-700">{followupOffer.discount_label}</span>
                  )}
                </p>
              )}
              {followupOffer.expires_at && (
                <p>
                  <span className="text-ink-500">期限:</span> {formatDate(followupOffer.expires_at)}
                </p>
              )}
              {followupOffer.notes && (
                <p className="text-xs text-ink-500 mt-2">{followupOffer.notes}</p>
              )}
            </div>
          </div>
        ) : (
          isFirstVisit && !contracted && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={14} className="inline -mt-0.5 mr-1" />
              フォローアップオファーが未設定です
            </div>
          )
        )}

        {/* 会員 LINE 連携状態 */}
        {!memberLineUserId ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
            <p className="font-medium mb-1">
              <AlertTriangle size={12} className="inline -mt-0.5 mr-1" />
              この会員に LINE userId が紐付いていません
            </p>
            <p>
              <Link href={`/members/${memberId}`} className="underline hover:text-amber-900">
                会員詳細
              </Link>{' '}
              から LINE 連携してください。お客様が公式 LINE を友だち追加すると、管理コンソールに userId が表示されます。
            </p>
          </div>
        ) : (
          memberLineDisplayName && (
            <p className="text-xs text-ink-500">
              送信先: <strong className="text-ink-700">{memberLineDisplayName}</strong>
            </p>
          )
        )}

        {/* 送信エラー */}
        {lineSendError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            前回エラー: {lineSendError}
          </div>
        )}

        {/* 送信ボタン */}
        <div className="flex gap-2">
          <Button
            onClick={send}
            disabled={!canSend || sending}
            size="lg"
            className="w-full"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {lineSentAt ? '再送信' : 'LINE で送信'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
