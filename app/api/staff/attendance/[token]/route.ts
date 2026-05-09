import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineMeters } from '@/lib/geo';

const ALLOWED_KINDS = new Set(['clock_in', 'clock_out', 'break_start', 'break_end']);

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const supabase = createServiceClient();
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, is_active')
    .eq('daily_report_token', params.token)
    .maybeSingle();
  if (!staff || !(staff as any).is_active) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { store_id, kind, latitude, longitude, accuracy } = body;
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, latitude, longitude, radius_meters, is_active')
    .eq('id', store_id)
    .maybeSingle();
  if (!store || !(store as any).is_active) {
    return NextResponse.json({ error: 'store not found' }, { status: 404 });
  }
  if ((store as any).latitude == null || (store as any).longitude == null) {
    return NextResponse.json(
      { error: '店舗の座標が未設定です。管理者に連絡してください。' },
      { status: 400 },
    );
  }

  const distance = haversineMeters(
    latitude,
    longitude,
    (store as any).latitude,
    (store as any).longitude,
  );
  if (distance > (store as any).radius_meters) {
    return NextResponse.json(
      {
        error: `店舗から ${Math.round(distance)}m 離れています。許容範囲 ${
          (store as any).radius_meters
        }m 以内で打刻してください。`,
      },
      { status: 403 },
    );
  }

  const { data: log, error } = await supabase
    .from('attendance_logs')
    .insert({
      staff_id: (staff as any).id,
      store_id: (store as any).id,
      kind,
      latitude,
      longitude,
      distance_meters: distance,
      device_info: {
        userAgent: request.headers.get('user-agent') ?? null,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
        via: 'staff_token',
      },
    })
    .select('id, kind, clocked_at, distance_meters, store:stores(name)')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, log, staff_name: (staff as any).display_name });
}
