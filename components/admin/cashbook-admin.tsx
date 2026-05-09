'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Pencil, Save, Trash2, X, Wallet, Loader2 } from 'lucide-react';
import { cn, formatYen, formatDate } from '@/lib/utils';
import type { CashbookEntry, CashbookSource, CashbookType } from '@/types/database';

interface Props {
  entries: CashbookEntry[];
  stores: { id: string; name: string }[];
  staff: any[];
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

export function CashbookAdmin({ entries, stores }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(entries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CashbookEntry | null>(null);
  const [storeFilter, setStoreFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CashbookType>('all');

  const filtered = useMemo(
    () =>
      items.filter((e) => {
        if (storeFilter && e.store_id !== storeFilter) return false;
        if (typeFilter !== 'all' && e.entry_type !== typeFilter) return false;
        return true;
      }),
    [items, storeFilter, typeFilter],
  );

  const totals = useMemo(() => {
    const income = filtered.filter((e) => e.entry_type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = filtered.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense, count: filtered.length };
  }, [filtered]);

  function startEdit(e: CashbookEntry) {
    setEditingId(e.id);
    setDraft({ ...e });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('cashbook_entries')
      .update({
        entry_date: draft.entry_date,
        entry_type: draft.entry_type,
        source: draft.source,
        category: draft.category,
        amount: draft.amount,
        description: draft.description,
        store_id: draft.store_id,
      })
      .eq('id', draft.id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setItems((list) => list.map((e) => (e.id === draft.id ? draft : e)));
    setEditingId(null);
    setDraft(null);
    toast.show('更新しました', 'success');
    router.refresh();
  }

  async function remove(id: string, isSquare: boolean) {
    if (isSquare) {
      if (!confirm('Square 連携の自動記録です。削除しても次回 Webhook で再登録される可能性があります。続行しますか?')) return;
    } else {
      if (!confirm('この記録を削除しますか?')) return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('cashbook_entries').delete().eq('id', id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setItems((list) => list.filter((e) => e.id !== id));
    toast.show('削除しました', 'success');
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 border-b border-ink-100">
        <Stat label="件数" value={`${totals.count} 件`} />
        <Stat label="入金合計" value={formatYen(totals.income)} tone="green" />
        <Stat label="出金合計" value={formatYen(totals.expense)} tone="red" />
        <Stat label="差引" value={formatYen(totals.balance)} tone="rose" />
      </div>

      <div className="flex gap-2 p-4 border-b border-ink-100">
        <Select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="w-44">
          <option value="">全店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | CashbookType)}
          className="w-36"
        >
          <option value="all">全区分</option>
          <option value="income">入金</option>
          <option value="expense">出金</option>
          <option value="adjustment">調整</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Wallet size={28} />} title="該当する記録がありません" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>日付</th>
                <th>区分</th>
                <th>カテゴリ</th>
                <th>支払</th>
                <th>説明</th>
                <th className="text-right">金額</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const editing = editingId === e.id && draft;
                const isSquare = !!e.square_payment_id;
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">
                      {editing ? (
                        <Input
                          type="date"
                          value={draft!.entry_date}
                          onChange={(ev) =>
                            setDraft({ ...draft!, entry_date: ev.target.value })
                          }
                        />
                      ) : (
                        <span className="text-xs text-ink-500">{formatDate(e.entry_date)}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <Select
                          value={draft!.entry_type}
                          onChange={(ev) =>
                            setDraft({ ...draft!, entry_type: ev.target.value as CashbookType })
                          }
                          className="w-24"
                        >
                          <option value="income">入金</option>
                          <option value="expense">出金</option>
                          <option value="adjustment">調整</option>
                        </Select>
                      ) : (
                        <Badge
                          tone={
                            e.entry_type === 'income'
                              ? 'green'
                              : e.entry_type === 'expense'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {typeLabel[e.entry_type]}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <Input
                          value={draft!.category}
                          onChange={(ev) =>
                            setDraft({ ...draft!, category: ev.target.value })
                          }
                        />
                      ) : (
                        <span className="text-sm">{e.category}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <Select
                          value={draft!.source}
                          onChange={(ev) =>
                            setDraft({ ...draft!, source: ev.target.value as CashbookSource })
                          }
                          className="w-24"
                        >
                          <option value="cash">現金</option>
                          <option value="square">Square</option>
                          <option value="bank">銀行</option>
                          <option value="online">オンライン</option>
                          <option value="other">その他</option>
                        </Select>
                      ) : (
                        <span className="text-xs text-ink-500">{sourceLabel[e.source]}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <Input
                          value={draft!.description ?? ''}
                          onChange={(ev) =>
                            setDraft({ ...draft!, description: ev.target.value || null })
                          }
                        />
                      ) : (
                        <span className="text-xs text-ink-600 truncate block max-w-xs">
                          {e.description ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {editing ? (
                        <Input
                          type="number"
                          value={draft!.amount}
                          onChange={(ev) =>
                            setDraft({ ...draft!, amount: Number(ev.target.value) || 0 })
                          }
                          className="w-28 text-right"
                        />
                      ) : (
                        <span className={cn('font-medium', e.entry_type === 'expense' && 'text-red-600')}>
                          {e.entry_type === 'expense' ? '-' : ''}
                          {formatYen(e.amount)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {editing ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={save}
                            className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                            aria-label="保存"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded p-1.5 text-ink-400 hover:bg-ink-100"
                            aria-label="キャンセル"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(e)}
                            className="rounded p-1.5 text-ink-500 hover:bg-vivie-50 hover:text-vivie-600"
                            aria-label="編集"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => remove(e.id, isSquare)}
                            className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red' | 'rose';
}) {
  const toneClass: Record<string, string> = {
    default: 'text-ink-900',
    green: 'text-emerald-700',
    red: 'text-red-700',
    rose: 'text-vivie-700',
  };
  return (
    <div className="rounded-xl bg-ink-50/40 px-3 py-2.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-0.5 font-serif text-lg font-semibold ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}
