'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { MapPin, Plus, Save, Trash2, Crosshair, Loader2 } from 'lucide-react';
import type { Store } from '@/types/database';

export function StoreSettings({ stores, canEdit }: { stores: Store[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(stores);

  function update(id: string, patch: Partial<Store>) {
    setItems((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function save(store: Store) {
    const supabase = createClient();
    const { error } = await supabase
      .from('stores')
      .update({
        name: store.name,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        radius_meters: store.radius_meters,
        square_location_id: store.square_location_id,
        is_active: store.is_active,
      })
      .eq('id', store.id);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show('保存しました', 'success');
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm('この店舗を削除しますか? 関連データも参照不可になる可能性があります')) return;
    const supabase = createClient();
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setItems((list) => list.filter((s) => s.id !== id));
    toast.show('削除しました', 'success');
  }

  async function addNew() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stores')
      .insert({ name: '新規店舗', radius_meters: 300 })
      .select('*')
      .single();
    if (error || !data) {
      toast.show(error?.message ?? '追加に失敗しました', 'error');
      return;
    }
    setItems((list) => [...list, data]);
  }

  function setMyLocation(id: string) {
    if (!navigator.geolocation) {
      toast.show('位置情報に対応していません', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update(id, {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
        toast.show('現在地を反映しました。保存ボタンで確定します', 'info');
      },
      (err) => toast.show(err.message, 'error'),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <div key={s.id} className="rounded-xl border border-ink-100 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="店舗名">
              <Input value={s.name} disabled={!canEdit} onChange={(e) => update(s.id, { name: e.target.value })} />
            </Field>
            <Field label="住所">
              <Input
                value={s.address ?? ''}
                disabled={!canEdit}
                onChange={(e) => update(s.id, { address: e.target.value })}
              />
            </Field>
            <Field label="緯度 (lat)">
              <Input
                type="number"
                step="0.000001"
                disabled={!canEdit}
                value={s.latitude ?? ''}
                onChange={(e) =>
                  update(s.id, { latitude: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Field label="経度 (lng)">
              <Input
                type="number"
                step="0.000001"
                disabled={!canEdit}
                value={s.longitude ?? ''}
                onChange={(e) =>
                  update(s.id, { longitude: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Field label="許容範囲 (m)" hint="この範囲内でのみ打刻可能">
              <Input
                type="number"
                min={50}
                max={2000}
                disabled={!canEdit}
                value={s.radius_meters}
                onChange={(e) => update(s.id, { radius_meters: Number(e.target.value) || 300 })}
              />
            </Field>
            <Field label="Square Location ID" hint="Square 同期で使用">
              <Input
                disabled={!canEdit}
                value={s.square_location_id ?? ''}
                onChange={(e) => update(s.id, { square_location_id: e.target.value || null })}
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {s.latitude != null && s.longitude != null ? (
              <Badge tone="green">
                <MapPin size={12} /> 座標登録済
              </Badge>
            ) : (
              <Badge tone="amber">
                <MapPin size={12} /> 座標未設定
              </Badge>
            )}
            {!s.is_active && <Badge tone="default">無効</Badge>}
            <div className="ml-auto flex gap-2">
              {canEdit && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setMyLocation(s.id)}>
                    <Crosshair size={14} />
                    現在地で設定
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => save(s)}>
                    <Save size={14} />
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {canEdit && (
        <Button variant="secondary" onClick={addNew}>
          <Plus size={14} />
          店舗を追加
        </Button>
      )}
    </div>
  );
}
