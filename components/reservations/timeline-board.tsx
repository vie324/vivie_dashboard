'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Source = 'hpb' | 'minimo' | 'phone' | 'direct' | 'line' | 'instagram' | 'threads' | 'other';
type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Reservation {
  id: string;
  member_id: string | null;
  customer_name: string;
  source: Source;
  reservation_at: string;
  end_at: string;
  duration_minutes: number;
  menu: string | null;
  staff_id: string | null;
  staff_name: string | null;
  store_id: string;
  store_name: string | null;
  status: Status;
  member_full_name: string | null;
  member_picture: string | null;
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

const statusBg: Record<Status, string> = {
  pending: 'rgba(251, 191, 36, 0.15)',
  confirmed: 'rgba(34, 197, 94, 0.12)',
  completed: 'rgba(148, 163, 184, 0.18)',
  cancelled: 'rgba(239, 68, 68, 0.12)',
  no_show: 'rgba(239, 68, 68, 0.12)',
};

const HOUR_START = 9;
const HOUR_END = 22;
const HOUR_WIDTH = 96; // px per hour
const ROW_HEIGHT = 72; // px per staff row
const STAFF_COL_WIDTH = 144;
const MIN_BLOCK_WIDTH = 56;

interface Props {
  date: string; // YYYY-MM-DD
  reservations: Reservation[];
  stores: { id: string; name: string }[];
  staff: { id: string; display_name: string }[];
}

export function TimelineBoard({ date, reservations, stores, staff }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [storeFilter, setStoreFilter] = useState<string>(params.get('store') ?? '');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  function navigate(patch: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') sp.delete(k);
      else sp.set(k, v);
    });
    router.push(`/reservations?${sp.toString()}`);
  }

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    navigate({ date: d.toISOString().slice(0, 10) });
  }

  const filtered = useMemo(
    () => reservations.filter((r) => (storeFilter ? r.store_id === storeFilter : true)),
    [reservations, storeFilter],
  );

  // 担当ごとに行を作る (未指定行を末尾に追加)
  const rows = useMemo(() => {
    const visibleStaff = staff.filter((s) => filtered.some((r) => r.staff_id === s.id));
    const allStaff = filtered.some((r) => r.staff_id === null) ? [...staff, { id: '__unassigned__', display_name: '未指定' }] : staff;
    // 担当を持つスタッフが少ない場合は全スタッフを表示
    const list = visibleStaff.length > 0 ? allStaff : staff;
    return list;
  }, [staff, filtered]);

  // 時刻ヘッダ (各列の開始時刻ラベル: 9, 10, ..., 21)
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = HOUR_START; h < HOUR_END; h++) arr.push(h);
    return arr;
  }, []);

  const totalWidth = (HOUR_END - HOUR_START) * HOUR_WIDTH;

  // 当日のみ「現在時刻」を表示
  const isToday = date === new Date().toISOString().slice(0, 10);
  const nowOffset = useMemo(() => {
    const startMin = HOUR_START * 60;
    const endMin = HOUR_END * 60;
    const cur = now.getHours() * 60 + now.getMinutes();
    if (cur < startMin || cur > endMin) return null;
    return ((cur - startMin) / 60) * HOUR_WIDTH;
  }, [now]);

  // 初回マウント時: 現在時刻 (or 10:00) までスクロール
  useEffect(() => {
    if (!scrollRef.current) return;
    const target = isToday && nowOffset != null ? Math.max(nowOffset - 120, 0) : 0;
    scrollRef.current.scrollLeft = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, isToday]);

  function handleEmptyClick(staffId: string | null, hourOffset: number) {
    const totalMin = HOUR_START * 60 + Math.round(hourOffset / HOUR_WIDTH * 60 / 15) * 15;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    const sp = new URLSearchParams();
    sp.set('date', date);
    sp.set('time', `${hh}:${mm}`);
    if (staffId && staffId !== '__unassigned__') sp.set('staff', staffId);
    if (storeFilter) sp.set('store', storeFilter);
    router.push(`/reservations/new?${sp.toString()}`);
  }

  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()];

  return (
    <div className="space-y-3">
      {/* ヘッダ: 日付ナビ + フィルタ */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="rounded-lg border border-ink-200 bg-white p-2 hover:bg-ink-50"
              aria-label="前日"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate({ date: new Date().toISOString().slice(0, 10) })}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-ink-50"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="rounded-lg border border-ink-200 bg-white p-2 hover:bg-ink-50"
              aria-label="翌日"
            >
              <ChevronRight size={16} />
            </button>
            <div className="ml-2 flex items-center gap-2">
              <CalendarIcon size={16} className="text-vivie-500" />
              <input
                type="date"
                value={date}
                onChange={(e) => navigate({ date: e.target.value })}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm focus:border-vivie-300 focus:outline-none"
              />
              <p className="font-serif text-lg font-semibold">
                {date.slice(5).replace('-', '/')} ({wd})
                {isToday && <span className="ml-2 text-xs text-vivie-700">今日</span>}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={storeFilter}
                onChange={(e) => {
                  setStoreFilter(e.target.value);
                  navigate({ store: e.target.value || undefined });
                }}
                className="w-36"
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

          {/* 凡例 */}
          <div className="flex flex-wrap gap-3 text-[11px] text-ink-500">
            {(Object.keys(sourceLabel) as Source[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: sourceColor[s] }}
                />
                {sourceLabel[s]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* タイムライン本体 */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="overflow-x-auto"
            style={{ overscrollBehaviorX: 'contain' }}
          >
            <div className="relative" style={{ width: STAFF_COL_WIDTH + totalWidth + 8 }}>
              {/* 時刻ヘッダ */}
              <div
                className="sticky top-0 z-20 flex border-b border-ink-200 bg-white"
                style={{ height: 36 }}
              >
                <div
                  className="sticky left-0 z-30 shrink-0 border-r border-ink-200 bg-white"
                  style={{ width: STAFF_COL_WIDTH }}
                >
                  <div className="flex h-full items-center justify-center text-[11px] font-medium text-ink-500">
                    担当
                  </div>
                </div>
                <div className="relative" style={{ width: totalWidth, height: 36 }}>
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute top-0 flex h-full items-center justify-center border-l border-ink-200 text-[11px] text-ink-500"
                      style={{ left: i * HOUR_WIDTH, width: HOUR_WIDTH }}
                    >
                      {h}:00
                    </div>
                  ))}
                </div>
              </div>

              {/* 行 */}
              {rows.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-ink-400">
                  この日の予約はまだありません
                </div>
              ) : (
                rows.map((s) => (
                  <StaffRow
                    key={s.id}
                    staff={s}
                    reservations={filtered.filter((r) =>
                      s.id === '__unassigned__' ? r.staff_id === null : r.staff_id === s.id,
                    )}
                    totalWidth={totalWidth}
                    onEmptyClick={(offset) => handleEmptyClick(s.id, offset)}
                  />
                ))
              )}

              {/* 現在時刻の縦線 */}
              {isToday && nowOffset != null && (
                <div
                  className="pointer-events-none absolute z-10"
                  style={{
                    left: STAFF_COL_WIDTH + nowOffset,
                    top: 36,
                    bottom: 0,
                    width: 2,
                    background: '#EF4444',
                    boxShadow: '0 0 0 1px rgba(239,68,68,.2)',
                  }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffRow({
  staff,
  reservations,
  totalWidth,
  onEmptyClick,
}: {
  staff: { id: string; display_name: string };
  reservations: Reservation[];
  totalWidth: number;
  onEmptyClick: (hourOffset: number) => void;
}) {
  return (
    <div className="flex border-b border-ink-100" style={{ height: ROW_HEIGHT }}>
      {/* 担当ラベル (sticky) */}
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-ink-200 bg-white"
        style={{ width: STAFF_COL_WIDTH }}
      >
        <div className="flex h-full items-center px-3">
          <p className="truncate text-sm font-medium">{staff.display_name}</p>
        </div>
      </div>

      {/* タイムライン */}
      <div
        className="relative"
        style={{ width: totalWidth, height: ROW_HEIGHT }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-reservation]')) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const offset = e.clientX - rect.left;
          onEmptyClick(offset);
        }}
      >
        {/* 縦のグリッド (1 時間ごと) + 30 分ハーフライン */}
        {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
          <div key={i}>
            <div
              className="absolute top-0 border-l border-ink-100"
              style={{ left: i * HOUR_WIDTH, height: ROW_HEIGHT }}
            />
            <div
              className="absolute top-0 border-l border-dashed border-ink-100/60"
              style={{ left: i * HOUR_WIDTH + HOUR_WIDTH / 2, height: ROW_HEIGHT }}
            />
          </div>
        ))}

        {/* 予約ブロック */}
        {reservations.map((r) => (
          <ReservationBlock key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

function ReservationBlock({ r }: { r: Reservation }) {
  const start = new Date(r.reservation_at);
  const end = new Date(r.end_at);

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const left = ((startMin - HOUR_START * 60) / 60) * HOUR_WIDTH;
  const widthRaw = ((Math.max(endMin, startMin + 15) - startMin) / 60) * HOUR_WIDTH;
  const width = Math.max(widthRaw, MIN_BLOCK_WIDTH);

  const fmt = (d: Date) =>
    d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });

  const isCancel = r.status === 'cancelled' || r.status === 'no_show';

  return (
    <Link
      data-reservation
      href={`/reservations/${r.id}`}
      className={cn(
        'absolute top-1 bottom-1 flex flex-col gap-0.5 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-[11px] shadow-sm transition-shadow hover:shadow-md',
        isCancel && 'opacity-50',
      )}
      style={{
        left,
        width,
        background: statusBg[r.status],
        borderLeftColor: sourceColor[r.source],
        borderTop: '1px solid rgba(0,0,0,.05)',
        borderRight: '1px solid rgba(0,0,0,.05)',
        borderBottom: '1px solid rgba(0,0,0,.05)',
      }}
      title={`${fmt(start)}-${fmt(end)} ${r.member_full_name ?? r.customer_name} / ${r.menu ?? ''}`}
    >
      <p
        className={cn(
          'truncate font-mono text-[10px] text-ink-600',
          isCancel && 'line-through',
        )}
      >
        {fmt(start)}–{fmt(end)}
      </p>
      <p className={cn('truncate text-[12px] font-semibold leading-tight', isCancel && 'line-through')}>
        {r.member_full_name ?? r.customer_name}
      </p>
      {r.menu && <p className="truncate text-[10px] text-ink-500 leading-tight">{r.menu}</p>}
      {r.status === 'pending' && (
        <Badge tone="amber" className="absolute right-1 top-1 text-[9px] px-1 py-0">
          仮
        </Badge>
      )}
    </Link>
  );
}
