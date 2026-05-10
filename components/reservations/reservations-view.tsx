'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Field, Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Calendar as CalendarIcon, Filter, Clock } from 'lucide-react';
import { cn, formatYen } from '@/lib/utils';

type Source = 'hpb' | 'minimo' | 'phone' | 'direct' | 'line' | 'instagram' | 'threads' | 'other';
type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Reservation {
  id: string;
  member_id: string | null;
  customer_name: string;
  customer_furigana: string | null;
  customer_phone: string | null;
  source: Source;
  source_label: string | null;
  reservation_at: string;
  end_at: string;
  duration_minutes: number;
  menu: string | null;
  amount: number | null;
  staff_id: string | null;
  staff_name: string | null;
  store_id: string;
  store_name: string | null;
  status: Status;
  member_full_name: string | null;
  member_picture: string | null;
  member_phone: string | null;
}

const sourceColor: Record<Source, string> = {
  hpb: '#F59E0B',
  minimo: '#DCA9A8',
  phone: '#6B6359',
  direct: '#22C55E',
  line: '#10B981',
  instagram: '#EC4899',
  threads: '#0EA5E9',
  other: '#94A3B8',
};

const sourceLabel: Record<Source, string> = {
  hpb: 'HPB',
  minimo: 'minimo',
  phone: '電話',
  direct: '直接',
  line: 'LINE',
  instagram: 'Instagram',
  threads: 'Threads',
  other: 'その他',
};

const statusTone: Record<Status, 'green' | 'amber' | 'default' | 'red' | 'rose'> = {
  pending: 'amber',
  confirmed: 'green',
  completed: 'default',
  cancelled: 'red',
  no_show: 'red',
};

const statusLabel: Record<Status, string> = {
  pending: '仮予約',
  confirmed: '予約確定',
  completed: '来店済',
  cancelled: 'キャンセル',
  no_show: '無断欠席',
};

interface Props {
  center: string;
  range: 'day' | 'week' | 'month';
  reservations: Reservation[];
  stores: { id: string; name: string }[];
  staff: { id: string; display_name: string }[];
}

export function ReservationsView({ center, range, reservations, stores, staff }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('');

  function navigate(patch: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => sp.set(k, v));
    router.push(`/reservations?${sp.toString()}`);
  }

  const filtered = useMemo(
    () =>
      reservations.filter((r) => {
        if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (staffFilter && r.staff_id !== staffFilter) return false;
        if (storeFilter && r.store_id !== storeFilter) return false;
        return true;
      }),
    [reservations, sourceFilter, statusFilter, staffFilter, storeFilter],
  );

  // 日付別にグループ化
  const byDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of filtered) {
      const day = r.reservation_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter((r) => r.status === 'confirmed').length;
    const completed = filtered.filter((r) => r.status === 'completed').length;
    const cancelled = filtered.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length;
    return { total, confirmed, completed, cancelled };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* 期間切替 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="基準日" className="sm:w-48">
              <Input
                type="date"
                value={center}
                onChange={(e) => navigate({ date: e.target.value })}
              />
            </Field>
            <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 self-end">
              {(['day', 'week', 'month'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => navigate({ range: r })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    range === r ? 'bg-vivie-100 text-vivie-700' : 'text-ink-500 hover:bg-ink-50',
                  )}
                >
                  {r === 'day' ? '当日' : r === 'week' ? '週間 (前後)' : '月'}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as Source | 'all')}
                className="w-32"
              >
                <option value="all">全媒体</option>
                {(Object.keys(sourceLabel) as Source[]).map((s) => (
                  <option key={s} value={s}>
                    {sourceLabel[s]}
                  </option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
                className="w-32"
              >
                <option value="all">全状態</option>
                {(Object.keys(statusLabel) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </Select>
              <Select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-32"
              >
                <option value="">全担当</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </Select>
              <Select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-32"
              >
                <option value="">全店舗</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="表示中" value={stats.total} />
            <Stat label="予約確定" value={stats.confirmed} tone="green" />
            <Stat label="来店済" value={stats.completed} tone="default" />
            <Stat label="キャンセル等" value={stats.cancelled} tone="red" />
          </div>

          {/* 凡例 */}
          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(sourceLabel) as Source[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: sourceColor[s] }}
                />
                {sourceLabel[s]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {byDay.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<CalendarIcon size={28} />}
              title="この期間に予約はありません"
              description="右上の「新規予約」または「CSV 取込」から登録できます"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {byDay.map(([day, items]) => (
            <DaySection key={day} day={day} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function DaySection({ day, items }: { day: string; items: Reservation[] }) {
  const date = new Date(day);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  const isToday = day === new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent className="p-0">
        <div className={cn('px-5 py-2.5 border-b border-ink-100 flex items-center justify-between', isToday && 'bg-vivie-50/40')}>
          <p className="font-serif font-semibold">
            {day.slice(5).replace('-', '/')} ({wd})
            {isToday && <span className="ml-2 text-xs text-vivie-700">今日</span>}
          </p>
          <p className="text-xs text-ink-500">{items.length} 件</p>
        </div>
        <ul className="divide-y divide-ink-100">
          {items.map((r) => (
            <ReservationRow key={r.id} r={r} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ReservationRow({ r }: { r: Reservation }) {
  const start = new Date(r.reservation_at);
  const end = new Date(r.end_at);
  const fmt = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const isCancel = r.status === 'cancelled' || r.status === 'no_show';
  return (
    <li>
      <Link
        href={`/reservations/${r.id}`}
        className={cn(
          'flex items-center gap-3 px-5 py-3 hover:bg-vivie-50/30',
          isCancel && 'opacity-60',
        )}
      >
        {/* 媒体カラーバー */}
        <span
          className="w-1 h-12 rounded-full shrink-0"
          style={{ background: sourceColor[r.source] }}
        />
        <div className="w-20 shrink-0">
          <p className="text-sm font-mono">
            {fmt(start)}–{fmt(end)}
          </p>
          <p className="text-[10px] text-ink-400">{r.duration_minutes}分</p>
        </div>
        <Avatar name={r.customer_name} src={r.member_picture} size="sm" />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium truncate', isCancel && 'line-through')}>
            {r.member_full_name ?? r.customer_name}
          </p>
          <p className="text-xs text-ink-500 truncate">
            {r.menu ?? '—'}
            {r.staff_name && <span className="text-ink-400"> ・ {r.staff_name}</span>}
          </p>
        </div>
        <Badge tone="default" className="text-[10px]">
          {sourceLabel[r.source]}
        </Badge>
        <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
        {r.amount != null && (
          <span className="text-sm text-ink-700 hidden sm:inline">{formatYen(r.amount)}</span>
        )}
      </Link>
    </li>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'green' | 'red' | 'rose';
}) {
  const toneClass = {
    default: 'text-ink-900',
    green: 'text-emerald-700',
    red: 'text-red-700',
    rose: 'text-vivie-700',
  };
  return (
    <div className="rounded-xl bg-ink-50/40 border border-ink-100 px-3 py-2">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-0.5 font-serif text-xl font-semibold ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}
