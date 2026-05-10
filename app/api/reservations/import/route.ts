import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { transformWithPreset, type ParsedReservation } from '@/lib/reservation-import';

export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { text, preset, store_id, dry_run } = body;
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text が空です' }, { status: 400 });
  }
  if (!store_id) {
    return NextResponse.json({ error: '店舗を指定してください' }, { status: 400 });
  }
  const presetKey = (['hpb', 'minimo', 'generic'].includes(preset) ? preset : 'generic') as
    | 'hpb'
    | 'minimo'
    | 'generic';

  const { reservations: parsed, errors: parseErrors } = transformWithPreset(text, presetKey);

  // スタッフ名 → ID
  const supabase = createServiceClient();
  const { data: staffList } = await supabase.from('staff').select('id, display_name');
  const staffMap = new Map<string, string>();
  (staffList ?? []).forEach((s: any) => {
    const norm = (s.display_name ?? '').replace(/\s+/g, '');
    if (norm) staffMap.set(norm, s.id);
  });

  const records = parsed.map((p) => {
    const norm = (p.staff_name ?? '').replace(/\s+/g, '');
    const staffId = norm ? staffMap.get(norm) ?? null : null;
    return {
      customer_name: p.customer_name,
      customer_furigana: p.customer_furigana ?? null,
      customer_phone: p.customer_phone ?? null,
      customer_email: p.customer_email ?? null,
      source: p.source,
      external_id: p.external_id ?? null,
      reservation_at: p.reservation_at,
      duration_minutes: p.duration_minutes,
      menu: p.menu ?? null,
      amount: p.amount ?? null,
      staff_id: staffId,
      store_id,
      status: p.status,
      notes: p.notes ?? null,
      source_data: p.source_data ?? null,
      created_by: user.id,
    };
  });

  if (dry_run) {
    const unmatchedStaff = Array.from(
      new Set(parsed.filter((p) => p.staff_name && !staffMap.has(p.staff_name.replace(/\s+/g, ''))).map((p) => p.staff_name)),
    );
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total: parsed.length,
      preview: records.slice(0, 5),
      parse_errors: parseErrors,
      unmatched_staff: unmatchedStaff,
    });
  }

  let inserted = 0;
  const insertErrors: string[] = [];
  for (let i = 0; i < records.length; i += 100) {
    const chunk = records.slice(i, i + 100);
    // external_id が指定されている場合は重複を避けるため upsert
    const { error, count } = await supabase
      .from('reservations')
      .upsert(chunk, { onConflict: 'source,external_id', ignoreDuplicates: false, count: 'exact' });
    if (error) insertErrors.push(`row ${i}: ${error.message}`);
    else inserted += count ?? chunk.length;
  }

  return NextResponse.json({
    ok: true,
    total: parsed.length,
    inserted,
    parse_errors: parseErrors,
    insert_errors: insertErrors,
  });
}
