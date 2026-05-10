'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Plus, Save, Trash2, Loader2 } from 'lucide-react';
import { formatYen } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  total_count: number;
  price: number;
  validity_months: number;
  is_active: boolean;
  display_order: number;
  notes: string | null;
}

export function TicketPlansAdmin({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(plans);
  const [saving, setSaving] = useState<string | null>(null);

  function update(id: string, patch: Partial<Plan>) {
    setItems((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function save(p: Plan) {
    setSaving(p.id);
    const supabase = createClient();
    const { error } = await supabase
      .from('ticket_plans')
      .update({
        name: p.name,
        total_count: p.total_count,
        price: p.price,
        validity_months: p.validity_months,
        is_active: p.is_active,
        display_order: p.display_order,
        notes: p.notes,
      })
      .eq('id', p.id);
    setSaving(null);
    if (error) toast.show(error.message, 'error');
    else {
      toast.show('保存しました', 'success');
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm('このプランを削除しますか? (発行済チケットには影響しません)')) return;
    const supabase = createClient();
    const { error } = await supabase.from('ticket_plans').delete().eq('id', id);
    if (error) toast.show(error.message, 'error');
    else {
      setItems((list) => list.filter((p) => p.id !== id));
      toast.show('削除しました', 'success');
    }
  }

  async function addNew() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ticket_plans')
      .insert({ name: '新しいプラン', total_count: 5, price: 0, validity_months: 6 })
      .select('*')
      .single();
    if (error || !data) {
      toast.show(error?.message ?? '追加に失敗しました', 'error');
      return;
    }
    setItems((list) => [...list, data as Plan]);
  }

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Field label="プラン名" className="sm:col-span-2">
                <Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
              </Field>
              <Field label="表示順">
                <Input
                  type="number"
                  value={p.display_order}
                  onChange={(e) => update(p.id, { display_order: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="状態">
                <select
                  value={p.is_active ? 'active' : 'inactive'}
                  onChange={(e) => update(p.id, { is_active: e.target.value === 'active' })}
                  className="w-full h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm"
                >
                  <option value="active">有効</option>
                  <option value="inactive">無効</option>
                </select>
              </Field>
              <Field label="回数">
                <Input
                  type="number"
                  min={1}
                  value={p.total_count}
                  onChange={(e) => update(p.id, { total_count: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label="価格 (円)">
                <Input
                  type="number"
                  min={0}
                  value={p.price}
                  onChange={(e) => update(p.id, { price: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="有効期間 (月)">
                <Input
                  type="number"
                  min={1}
                  value={p.validity_months}
                  onChange={(e) => update(p.id, { validity_months: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label="1回あたり">
                <p className="h-9 inline-flex items-center text-sm text-ink-700">
                  {formatYen(Math.round(p.price / Math.max(1, p.total_count)))}
                </p>
              </Field>
              <Field label="メモ" className="sm:col-span-4">
                <Input
                  value={p.notes ?? ''}
                  onChange={(e) => update(p.id, { notes: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <Badge tone={p.is_active ? 'green' : 'default'}>
                {p.is_active ? '有効' : '無効'}
              </Badge>
              <div className="flex gap-2">
                <Button onClick={() => remove(p.id)} variant="ghost" size="sm">
                  <Trash2 size={14} className="text-red-500" />
                </Button>
                <Button onClick={() => save(p)} size="sm" disabled={saving === p.id}>
                  {saving === p.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  保存
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="secondary" onClick={addNew}>
        <Plus size={14} />
        プランを追加
      </Button>
    </div>
  );
}
