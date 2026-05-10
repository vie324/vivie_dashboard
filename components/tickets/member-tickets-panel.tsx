'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Ticket, Plus, Loader2, Minus, Undo2, AlertTriangle } from 'lucide-react';
import { formatDate, formatYen } from '@/lib/utils';

interface PlanOpt {
  id: string;
  name: string;
  total_count: number;
  price: number;
  validity_months: number;
}

interface TicketRow {
  id: string;
  plan_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  price: number;
  purchased_at: string;
  expires_at: string;
  days_until_expiry: number;
  effective_status: 'active' | 'used_up' | 'expired' | 'refunded';
  notes: string | null;
}

interface Props {
  memberId: string;
  storeId: string | null;
  tickets: TicketRow[];
  plans: PlanOpt[];
  isManager: boolean;
}

export function MemberTicketsPanel({ memberId, storeId, tickets, plans, isManager }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [showIssue, setShowIssue] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    plan_id: plans[0]?.id ?? '',
    purchased_at: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  async function issue() {
    if (!form.plan_id) {
      toast.show('プランを選択してください', 'error');
      return;
    }
    setBusy('issue');
    try {
      const res = await fetch('/api/tickets/issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          plan_id: form.plan_id,
          purchased_at: form.purchased_at,
          store_id: storeId,
          notes: form.notes || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗しました');
      toast.show('回数券を発行しました', 'success');
      setShowIssue(false);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function useOne(ticketId: string) {
    if (!confirm('1 回消費します。よろしいですか?')) return;
    setBusy(`use:${ticketId}`);
    try {
      const res = await fetch('/api/tickets/use', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗しました');
      toast.show(`使用しました (残 ${body.remaining})`, 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function refund(ticketId: string) {
    const reason = prompt('返金理由を入力してください (任意)') ?? '';
    setBusy(`refund:${ticketId}`);
    try {
      const res = await fetch('/api/tickets/refund', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗しました');
      toast.show('返金処理しました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Ticket size={18} className="text-vivie-500" />
          回数券
        </CardTitle>
        <Button onClick={() => setShowIssue(true)} size="sm" disabled={plans.length === 0}>
          <Plus size={14} />
          発行
        </Button>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-6">
            まだ発行された回数券はありません
          </p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => {
              const usedPct = (t.used_count / t.total_count) * 100;
              const expiringSoon = t.effective_status === 'active' && t.days_until_expiry <= 30;
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-ink-100 p-3 hover:border-vivie-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{t.plan_name}</p>
                        {t.effective_status === 'active' && <Badge tone="green">有効</Badge>}
                        {t.effective_status === 'used_up' && <Badge tone="default">使い切り</Badge>}
                        {t.effective_status === 'expired' && <Badge tone="amber">期限切れ</Badge>}
                        {t.effective_status === 'refunded' && <Badge tone="red">返金済</Badge>}
                        {expiringSoon && (
                          <Badge tone="amber" className="text-[10px]">
                            <AlertTriangle size={10} />
                            あと {Math.max(0, t.days_until_expiry)} 日
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        購入 {formatDate(t.purchased_at)} / 期限 {formatDate(t.expires_at)} ・{' '}
                        {formatYen(t.price)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                          <div
                            className="h-full bg-vivie-400"
                            style={{ width: `${Math.min(100, usedPct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-ink-700">
                          残 {t.remaining_count} / {t.total_count}
                        </span>
                      </div>
                      {t.notes && (
                        <p className="mt-2 text-xs text-ink-500">{t.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {t.effective_status === 'active' && (
                        <Button
                          onClick={() => useOne(t.id)}
                          disabled={busy === `use:${t.id}`}
                          size="sm"
                          variant="primary"
                        >
                          {busy === `use:${t.id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Minus size={12} />
                          )}
                          1 回使う
                        </Button>
                      )}
                      {isManager && t.effective_status !== 'refunded' && (
                        <Button
                          onClick={() => refund(t.id)}
                          disabled={busy === `refund:${t.id}`}
                          size="sm"
                          variant="ghost"
                        >
                          {busy === `refund:${t.id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Undo2 size={12} />
                          )}
                          返金
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {plans.length === 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            プランが未登録です。/tickets/plans から登録してください。
          </p>
        )}
      </CardContent>

      <Modal
        open={showIssue}
        onClose={() => setShowIssue(false)}
        title="回数券を発行"
        description="プランを選んで発行ボタンを押してください"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowIssue(false)}>
              キャンセル
            </Button>
            <Button onClick={issue} disabled={busy === 'issue'}>
              {busy === 'issue' && <Loader2 size={14} className="animate-spin" />}
              <Plus size={14} />
              発行
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="プラン" required>
            <Select
              value={form.plan_id}
              onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.total_count}回 / {formatYen(p.price)} / 有効{p.validity_months}ヶ月)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="購入日">
            <Input
              type="date"
              value={form.purchased_at}
              onChange={(e) => setForm((f) => ({ ...f, purchased_at: e.target.value }))}
            />
          </Field>
          <Field label="メモ (任意)">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
