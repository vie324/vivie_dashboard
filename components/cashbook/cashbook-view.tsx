'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet, Loader2, X } from 'lucide-react';
import { cn, formatYen, formatDate, todayISO } from '@/lib/utils';
import type { CashbookEntry, CashbookSource, CashbookType } from '@/types/database';

interface EntryWithMeta extends CashbookEntry {
  recorded_by_staff?: { display_name: string } | null;
}

interface Props {
  stores: { id: string; name: string }[];
  initialEntries: EntryWithMeta[];
  initialMonth: string;
  initialStoreId: string;
}

const sourceLabel: Record<CashbookSource, string> = {
  cash: '現金',
  square: 'Square',
  bank: '銀行',
  online: 'オンライン',
  other: 'その他',
};

const typeLabel: Record<CashbookType, string> = {
  income: '入金',
  expense: '出金',
  adjustment: '調整',
};

export function CashbookView({ stores, initialEntries, initialMonth, initialStoreId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState(initialMonth);
  const [storeId, setStoreId] = useState(initialStoreId);
  const [entries, setEntries] = useState(initialEntries);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(
    () => entries.filter((e) => !storeId || e.store_id === storeId),
    [entries, storeId],
  );

  const totals = useMemo(() => {
    const income = filtered.filter((e) => e.entry_type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = filtered.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  function applyFilter(nextMonth: string, nextStore: string) {
    const params = new URLSearchParams();
    params.set('month', nextMonth);
    if (nextStore) params.set('store', nextStore);
    router.push(`/cashbook?${params.toString()}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('cashbook_entries').delete().eq('id', id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setEntries((list) => list.filter((e) => e.id !== id));
    toast.show('削除しました', 'success');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Field label="月" className="sm:w-44">
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                applyFilter(e.target.value, storeId);
              }}
            />
          </Field>
          <Field label="店舗" className="sm:w-56">
            <Select
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                applyFilter(month, e.target.value);
              }}
            >
              <option value="">全店舗</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={14} />
          記入する
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="入金" value={totals.income} icon={<ArrowDownCircle size={18} />} tone="green" />
        <SummaryCard label="出金" value={totals.expense} icon={<ArrowUpCircle size={18} />} tone="red" />
        <SummaryCard label="差引" value={totals.balance} icon={<Wallet size={18} />} tone="rose" />
      </div>

      {showForm && (
        <CashbookEntryForm
          stores={stores}
          defaultStoreId={storeId || stores[0]?.id || ''}
          onClose={() => setShowForm(false)}
          onCreated={(entry) => {
            setEntries((list) => [entry, ...list]);
            setShowForm(false);
            router.refresh();
          }}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Wallet size={28} />}
              title="この期間の記録はありません"
              description="右上の「記入する」から入出金を登録できます"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>区分</th>
                    <th>カテゴリ</th>
                    <th>支払方法</th>
                    <th>説明</th>
                    <th className="text-right">金額</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(e.entry_date)}</td>
                      <td>
                        <Badge tone={e.entry_type === 'income' ? 'green' : e.entry_type === 'expense' ? 'red' : 'amber'}>
                          {typeLabel[e.entry_type]}
                        </Badge>
                      </td>
                      <td className="text-sm">{e.category}</td>
                      <td className="text-xs text-ink-500">{sourceLabel[e.source]}</td>
                      <td className="text-xs text-ink-600 max-w-xs truncate">{e.description ?? '—'}</td>
                      <td className={cn('text-right font-medium', e.entry_type === 'expense' && 'text-red-600')}>
                        {e.entry_type === 'expense' ? '-' : ''}
                        {formatYen(e.amount)}
                      </td>
                      <td className="text-right">
                        {!e.square_payment_id && (
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'rose';
}) {
  const toneClass: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    rose: 'bg-vivie-100 text-vivie-700',
  };
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', toneClass[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-2 font-serif text-2xl font-semibold text-ink-900">{formatYen(value)}</p>
    </div>
  );
}

function CashbookEntryForm({
  stores,
  defaultStoreId,
  onClose,
  onCreated,
}: {
  stores: { id: string; name: string }[];
  defaultStoreId: string;
  onClose: () => void;
  onCreated: (entry: any) => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    store_id: defaultStoreId,
    entry_date: todayISO(),
    entry_type: 'income' as CashbookType,
    source: 'cash' as CashbookSource,
    category: '',
    amount: '',
    description: '',
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('金額を正しく入力してください');
      }
      const { data, error } = await supabase
        .from('cashbook_entries')
        .insert({
          store_id: form.store_id,
          entry_date: form.entry_date,
          entry_type: form.entry_type,
          source: form.source,
          category: form.category || (form.entry_type === 'income' ? '売上' : '経費'),
          amount,
          description: form.description || null,
          recorded_by: user?.id ?? null,
        })
        .select('*, recorded_by_staff:staff!cashbook_entries_recorded_by_fkey(display_name)')
        .single();
      if (error) throw error;
      toast.show('登録しました', 'success');
      onCreated(data);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base font-semibold">新規記入</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100"
              aria-label="閉じる"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="店舗" required>
              <Select
                value={form.store_id}
                onChange={(e) => update('store_id', e.target.value)}
                required
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="日付" required>
              <Input
                type="date"
                value={form.entry_date}
                onChange={(e) => update('entry_date', e.target.value)}
                required
              />
            </Field>
            <Field label="区分" required>
              <Select
                value={form.entry_type}
                onChange={(e) => update('entry_type', e.target.value as CashbookType)}
              >
                <option value="income">入金</option>
                <option value="expense">出金</option>
                <option value="adjustment">調整</option>
              </Select>
            </Field>
            <Field label="支払方法" required>
              <Select
                value={form.source}
                onChange={(e) => update('source', e.target.value as CashbookSource)}
              >
                <option value="cash">現金</option>
                <option value="square">Square</option>
                <option value="bank">銀行</option>
                <option value="online">オンライン</option>
                <option value="other">その他</option>
              </Select>
            </Field>
            <Field label="カテゴリ" hint="例: 施術売上 / 物販 / 仕入れ / 家賃">
              <Input
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder={form.entry_type === 'income' ? '売上' : '経費'}
              />
            </Field>
            <Field label="金額 (円)" required>
              <Input
                type="number"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => update('amount', e.target.value)}
                required
                min={1}
              />
            </Field>
            <Field label="説明" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="任意のメモ"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              登録
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
