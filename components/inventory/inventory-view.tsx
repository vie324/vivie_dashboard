'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  Package,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { formatYen } from '@/lib/utils';
import type { Product, StockMovementKind } from '@/types/database';

interface Props {
  initialProducts: Product[];
  canManage: boolean;
}

const kindLabel: Record<StockMovementKind, string> = {
  in: '入庫',
  out: '出庫',
  adjust: '棚卸調整',
};

const emptyForm = {
  name: '',
  category: '',
  unit_price: '',
  cost_price: '',
  current_stock: '',
  low_stock_threshold: '',
};

export function InventoryView({ initialProducts, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [moveTarget, setMoveTarget] = useState<Product | null>(null);
  const [moveKind, setMoveKind] = useState<StockMovementKind>('in');
  const [moveQty, setMoveQty] = useState('');
  const [moveReason, setMoveReason] = useState('');

  const stats = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    const low = active.filter((p) => p.current_stock <= p.low_stock_threshold);
    const value = active.reduce((s, p) => s + p.current_stock * p.cost_price, 0);
    return { count: active.length, low: low.length, value };
  }, [products]);

  async function addProduct() {
    if (!form.name.trim()) {
      toast.show('商品名を入力してください', 'error');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: form.name.trim(),
          category: form.category.trim() || null,
          unit_price: Number(form.unit_price) || 0,
          cost_price: Number(form.cost_price) || 0,
          current_stock: Number(form.current_stock) || 0,
          low_stock_threshold: Number(form.low_stock_threshold) || 0,
        })
        .select('*')
        .single();
      if (error) throw error;
      setProducts((list) =>
        [...list, data as Product].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      );
      setForm(emptyForm);
      setShowAdd(false);
      toast.show('商品を追加しました', 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '追加に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openMove(p: Product, kind: StockMovementKind) {
    setMoveTarget(p);
    setMoveKind(kind);
    setMoveQty('');
    setMoveReason('');
  }

  async function submitMove() {
    if (!moveTarget) return;
    const qty = Number(moveQty);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.show('数量を入力してください', 'error');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from('stock_movements').insert({
        product_id: moveTarget.id,
        kind: moveKind,
        quantity: qty,
        reason: moveReason.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      // トリガーで更新された在庫を取得して反映
      const { data: fresh } = await supabase
        .from('products')
        .select('*')
        .eq('id', moveTarget.id)
        .single();
      if (fresh) {
        setProducts((list) => list.map((p) => (p.id === moveTarget.id ? (fresh as Product) : p)));
      }
      toast.show(`${kindLabel[moveKind]}を記録しました`, 'success');
      setMoveTarget(null);
      router.refresh();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '記録に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="商品数" value={`${stats.count}`} icon={<Package size={16} />} />
        <Stat
          label="在庫僅少"
          value={`${stats.low}`}
          icon={<AlertTriangle size={16} />}
          tone={stats.low > 0 ? 'amber' : 'default'}
        />
        <Stat label="在庫金額(原価)" value={formatYen(stats.value)} tone="rose" />
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus size={14} />
            商品を追加
          </Button>
        </div>
      )}

      {showAdd && canManage && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="商品名 *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="カテゴリ">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="化粧品 / 消耗品 など"
              />
            </Field>
            <Field label="販売単価">
              <Input
                type="number"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </Field>
            <Field label="仕入単価">
              <Input
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              />
            </Field>
            <Field label="初期在庫">
              <Input
                type="number"
                value={form.current_stock}
                onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
              />
            </Field>
            <Field label="在庫僅少しきい値">
              <Input
                type="number"
                value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button onClick={addProduct} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                追加する
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <EmptyState
              icon={<Package size={28} />}
              title="商品がありません"
              description={canManage ? '「商品を追加」から登録してください。' : '管理者が商品を登録すると表示されます。'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>カテゴリ</th>
                    <th className="text-right">在庫</th>
                    <th className="text-right">販売単価</th>
                    <th className="text-right">在庫金額</th>
                    <th className="w-44 text-right">入出庫</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = p.current_stock <= p.low_stock_threshold;
                    return (
                      <tr key={p.id} className={p.is_active ? '' : 'opacity-50'}>
                        <td className="text-sm font-medium">{p.name}</td>
                        <td className="text-xs text-ink-500">{p.category ?? '—'}</td>
                        <td className="text-right">
                          <span className={`font-medium ${low ? 'text-amber-700' : ''}`}>
                            {p.current_stock}
                          </span>
                          {low && (
                            <Badge tone="amber" className="ml-1.5 text-[10px]">
                              僅少
                            </Badge>
                          )}
                        </td>
                        <td className="text-right text-sm">{formatYen(p.unit_price)}</td>
                        <td className="text-right text-sm text-ink-500">
                          {formatYen(p.current_stock * p.cost_price)}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openMove(p, 'in')}
                              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                              aria-label="入庫"
                              title="入庫"
                            >
                              <ArrowDownCircle size={16} />
                            </button>
                            <button
                              onClick={() => openMove(p, 'out')}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50"
                              aria-label="出庫"
                              title="出庫"
                            >
                              <ArrowUpCircle size={16} />
                            </button>
                            <button
                              onClick={() => openMove(p, 'adjust')}
                              className="rounded p-1.5 text-ink-500 hover:bg-ink-100"
                              aria-label="棚卸調整"
                              title="棚卸調整"
                            >
                              <ClipboardCheck size={16} />
                            </button>
                          </div>
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

      <Modal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title={moveTarget ? `${kindLabel[moveKind]}: ${moveTarget.name}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoveTarget(null)}>
              キャンセル
            </Button>
            <Button onClick={submitMove} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              記録する
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="種別">
            <Select value={moveKind} onChange={(e) => setMoveKind(e.target.value as StockMovementKind)}>
              <option value="in">入庫 (仕入・補充)</option>
              <option value="out">出庫 (販売・使用)</option>
              <option value="adjust">棚卸調整 (実数に上書き)</option>
            </Select>
          </Field>
          <Field label={moveKind === 'adjust' ? '実在庫数' : '数量'}>
            <Input
              type="number"
              min={0}
              value={moveQty}
              onChange={(e) => setMoveQty(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="メモ (任意)">
            <Input
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              placeholder="仕入先・用途など"
            />
          </Field>
          {moveTarget && (
            <p className="text-xs text-ink-500">現在の在庫: {moveTarget.current_stock}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'amber' | 'rose';
}) {
  const toneClass = {
    default: 'text-ink-900',
    amber: 'text-amber-700',
    rose: 'text-vivie-700',
  };
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">{label}</p>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <p className={`mt-1 font-serif text-2xl font-semibold ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}
