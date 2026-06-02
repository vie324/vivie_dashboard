import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const SLOT_MINUTES = 60;

// 自社オンライン予約の受付 (匿名アクセス可)。pending 予約として登録し、
// スタッフがダッシュボードで確定する運用。
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { storeId, date, time, name, phone, menu, notes } = body;
  if (!storeId || !date || !time || !name || !phone) {
    return NextResponse.json({ error: 'お名前・電話番号・日時は必須です' }, { status: 400 });
  }

  const reservationAt = new Date(`${date}T${time}:00+09:00`);
  if (Number.isNaN(reservationAt.getTime())) {
    return NextResponse.json({ error: '日時が不正です' }, { status: 400 });
  }
  if (reservationAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: '過去の日時は予約できません' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: store } = await supabase
    .from('stores')
    .select('id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (!store || !(store as any).is_active) {
    return NextResponse.json({ error: 'store not found' }, { status: 404 });
  }

  // 二重予約チェック (同店舗で時間が重なる有効予約があれば拒否)
  const startMs = reservationAt.getTime();
  const endMs = startMs + SLOT_MINUTES * 60000;
  const { data: nearby } = await supabase
    .from('reservations')
    .select('reservation_at, duration_minutes, status')
    .eq('store_id', storeId)
    .gte('reservation_at', new Date(startMs - SLOT_MINUTES * 60000).toISOString())
    .lte('reservation_at', new Date(endMs).toISOString());
  const conflict = (nearby ?? [])
    .filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show')
    .some((r: any) => {
      const s = new Date(r.reservation_at).getTime();
      const e = s + (r.duration_minutes || SLOT_MINUTES) * 60000;
      return startMs < e && s < endMs;
    });
  if (conflict) {
    return NextResponse.json(
      { error: 'その時間は埋まってしまいました。別の時間をお選びください。' },
      { status: 409 },
    );
  }

  const { error } = await supabase.from('reservations').insert({
    customer_name: String(name).slice(0, 100),
    customer_phone: String(phone).slice(0, 30),
    store_id: storeId,
    reservation_at: reservationAt.toISOString(),
    duration_minutes: SLOT_MINUTES,
    source: 'direct',
    source_label: '自社予約フォーム',
    status: 'pending',
    menu: menu ? String(menu).slice(0, 200) : null,
    notes: notes ? String(notes).slice(0, 500) : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
