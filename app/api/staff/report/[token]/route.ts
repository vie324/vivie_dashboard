import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// スタッフ専用 URL での日報送信 (トークン認証, anon でも書き込める)
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const supabase = createServiceClient();
  const { data: staff } = await supabase
    .from('staff')
    .select('id, is_active')
    .eq('daily_report_token', params.token)
    .maybeSingle();
  if (!staff || !staff.is_active) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!body.store_id || !body.report_date) {
    return NextResponse.json({ error: 'store_id and report_date required' }, { status: 400 });
  }

  const numKeys = [
    'hpb_new_count',
    'hpb_contract_count',
    'meta_new_count',
    'meta_contract_count',
    'minimo_new_count',
    'minimo_contract_count',
    'referral_new_count',
    'referral_contract_count',
    'existing_treatment_count',
    'repeat_count',
    'total_sales',
    'discount_total',
  ] as const;

  const payload: Record<string, unknown> = {
    staff_id: staff.id,
    store_id: body.store_id,
    report_date: body.report_date,
    highlights: body.highlights || null,
    challenges: body.challenges || null,
    next_actions: body.next_actions || null,
  };
  for (const k of numKeys) {
    payload[k] = Number(body[k]) || 0;
  }
  if (
    Number(body.repeat_count) > Number(body.existing_treatment_count)
  ) {
    return NextResponse.json(
      { error: 'リピート件数は既存施術件数を超えられません' },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('daily_reports')
    .upsert(payload, { onConflict: 'store_id,staff_id,report_date' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
