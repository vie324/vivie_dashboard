'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Pencil, Save, Trash2, X, MapPin, LogIn, LogOut, Coffee, Play } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { AttendanceKind } from '@/types/database';

interface LogRow {
  id: string;
  staff_id: string;
  store_id: string;
  kind: AttendanceKind;
  clocked_at: string;
  distance_meters: number;
  latitude: number;
  longitude: number;
  staff?: { display_name: string } | null;
  store?: { name: string } | null;
}

interface Props {
  logs: LogRow[];
  stores: { id: string; name: string }[];
  staff: any[];
}

const kindLabel: Record<AttendanceKind, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const kindIcon: Record<AttendanceKind, React.ComponentType<any>> = {
  clock_in: LogIn,
  clock_out: LogOut,
  break_start: Coffee,
  break_end: Play,
};

export function AttendanceAdmin({ logs, stores, staff }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(logs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<LogRow> | null>(null);
  const [staffFilter, setStaffFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');

  const filtered = useMemo(
    () =>
      items.filter((l) => {
        if (staffFilter && l.staff_id !== staffFilter) return false;
        if (storeFilter && l.store_id !== storeFilter) return false;
        return true;
      }),
    [items, staffFilter, storeFilter],
  );

  // 集計: スタッフごとの出勤日数 / 総打刻回数
  const summary = useMemo(() => {
    const map = new Map<string, { name: string; days: Set<string>; total: number }>();
    filtered.forEach((l) => {
      const name = l.staff?.display_name ?? '不明';
      if (!map.has(l.staff_id)) {
        map.set(l.staff_id, { name, days: new Set(), total: 0 });
      }
      const r = map.get(l.staff_id)!;
      r.total++;
      if (l.kind === 'clock_in') r.days.add(l.clocked_at.slice(0, 10));
    });
    return Array.from(map.values()).sort((a, b) => b.days.size - a.days.size);
  }, [filtered]);

  function startEdit(l: LogRow) {
    setEditingId(l.id);
    setDraft({
      ...l,
      // datetime-local 用の文字列に変換
      clocked_at: new Date(l.clocked_at).toISOString().slice(0, 16),
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function save() {
    if (!draft || !editingId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('attendance_logs')
      .update({
        kind: draft.kind,
        store_id: draft.store_id,
        clocked_at: new Date(draft.clocked_at as string).toISOString(),
      })
      .eq('id', editingId);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setItems((list) =>
      list.map((l) =>
        l.id === editingId
          ? {
              ...l,
              kind: draft.kind as AttendanceKind,
              store_id: draft.store_id as string,
              store: stores.find((s) => s.id === draft.store_id) ?? l.store,
              clocked_at: new Date(draft.clocked_at as string).toISOString(),
            }
          : l,
      ),
    );
    cancelEdit();
    toast.show('更新しました', 'success');
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('この打刻記録を削除しますか?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setItems((list) => list.filter((l) => l.id !== id));
    toast.show('削除しました', 'success');
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 border-b border-ink-100">
        <Stat label="打刻数" value={`${filtered.length} 件`} />
        <Stat label="スタッフ数" value={`${summary.length} 名`} />
        <Stat
          label="延べ出勤"
          value={`${summary.reduce((s, r) => s + r.days.size, 0)} 日`}
        />
      </div>

      {summary.length > 0 && (
        <div className="border-b border-ink-100 p-4">
          <p className="text-xs font-medium text-ink-500 mb-2">スタッフ別 出勤日数</p>
          <div className="flex flex-wrap gap-2">
            {summary.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-2 rounded-full bg-vivie-50/60 px-3 py-1 text-xs"
              >
                <strong className="font-medium text-vivie-700">{s.name}</strong>
                <span className="text-ink-500">{s.days.size}日 / {s.total}回</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 p-4 border-b border-ink-100">
        <Select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="w-44">
          <option value="">全スタッフ</option>
          {staff.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </Select>
        <Select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="w-44">
          <option value="">全店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<MapPin size={28} />} title="該当する打刻がありません" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>日時</th>
                <th>スタッフ</th>
                <th>区分</th>
                <th>店舗</th>
                <th className="text-right">距離</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const editing = editingId === l.id && draft;
                const Icon = kindIcon[l.kind];
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">
                      {editing ? (
                        <Input
                          type="datetime-local"
                          value={draft.clocked_at as string}
                          onChange={(e) => setDraft({ ...draft, clocked_at: e.target.value })}
                          className="w-44"
                        />
                      ) : (
                        <span className="text-xs text-ink-500">{formatDateTime(l.clocked_at)}</span>
                      )}
                    </td>
                    <td className="text-sm">{l.staff?.display_name ?? '—'}</td>
                    <td>
                      {editing ? (
                        <Select
                          value={draft.kind}
                          onChange={(e) =>
                            setDraft({ ...draft, kind: e.target.value as AttendanceKind })
                          }
                          className="w-32"
                        >
                          <option value="clock_in">出勤</option>
                          <option value="break_start">休憩開始</option>
                          <option value="break_end">休憩終了</option>
                          <option value="clock_out">退勤</option>
                        </Select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Icon size={14} className="text-vivie-500" />
                          {kindLabel[l.kind]}
                        </span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <Select
                          value={draft.store_id}
                          onChange={(e) => setDraft({ ...draft, store_id: e.target.value })}
                          className="w-36"
                        >
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-ink-600">{l.store?.name ?? '—'}</span>
                      )}
                    </td>
                    <td className="text-right text-xs text-ink-500">{Math.round(l.distance_meters)}m</td>
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
                            onClick={() => startEdit(l)}
                            className="rounded p-1.5 text-ink-500 hover:bg-vivie-50 hover:text-vivie-600"
                            aria-label="編集"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => remove(l.id)}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50/40 px-3 py-2.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 font-serif text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}
