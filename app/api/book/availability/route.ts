import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// 自社オンライン予約: 指定日の空き時間枠を返す (匿名アクセス可)
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SLOT_MINUTES = 60;
const DEFAULT_OPEN = '10:00';
const DEFAULT_CLOSE = '19:00';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
// timestamptz を JST の「その日の分」に変換
function jstMinutes(iso: string): number {
  const s = new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get('storeId');
  const date = url.searchParams.get('date'); // YYYY-MM-DD
  if (!storeId || !date) {
    return NextResponse.json({ error: 'storeId と date が必要です' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, is_active, business_hours')
    .eq('id', storeId)
    .maybeSingle();
  const s = store as any;
  if (!s || !s.is_active) return NextResponse.json({ error: 'store not found' }, { status: 404 });

  // 曜日を JST で判定 (正午で評価して TZ ズレを回避)
  const noon = new Date(`${date}T12:00:00+09:00`);
  if (Number.isNaN(noon.getTime())) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }
  const weekday = WEEKDAYS[noon.getUTCDay()];
  const bh = (s.business_hours ?? {}) as any;
  const holidays: string[] = Array.isArray(bh.regular_holiday) ? bh.regular_holiday : [];
  if (holidays.includes(weekday)) {
    return NextResponse.json({ slots: [] });
  }
  const dayHours = bh[weekday] ?? {};
  const openMin = toMinutes(dayHours.open ?? DEFAULT_OPEN);
  const closeMin = toMinutes(dayHours.close ?? DEFAULT_CLOSE);

  // 当日の既存予約 (キャンセル/無断以外) を取得し、埋まっている時間帯を算出
  const { data: reservations } = await supabase
    .from('reservations')
    .select('reservation_at, duration_minutes, status')
    .eq('store_id', storeId)
    .gte('reservation_at', new Date(`${date}T00:00:00+09:00`).toISOString())
    .lte('reservation_at', new Date(`${date}T23:59:59+09:00`).toISOString());

  const occupied = (reservations ?? [])
    .filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show')
    .map((r: any) => {
      const start = jstMinutes(r.reservation_at);
      return [start, start + (r.duration_minutes || SLOT_MINUTES)] as [number, number];
    });

  const slots: { time: string; available: boolean }[] = [];
  for (let t = openMin; t + SLOT_MINUTES <= closeMin; t += SLOT_MINUTES) {
    const overlaps = occupied.some(([os, oe]) => t < oe && os < t + SLOT_MINUTES);
    const past = new Date(`${date}T${fmt(t)}:00+09:00`).getTime() <= Date.now();
    slots.push({ time: fmt(t), available: !overlaps && !past });
  }

  return NextResponse.json({ slots });
}
