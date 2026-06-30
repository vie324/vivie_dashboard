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
    'hpb_existing_count',
    'hpb_repeat_count',
    'meta_existing_count',
    'meta_repeat_count',
    'minimo_existing_count',
    'minimo_repeat_count',
    'referral_existing_count',
    'referral_repeat_count',
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
    payload[k] = Math.max(0, Number(body[k]) || 0);
  }
  const n = (k: string) => Number(payload[k]) || 0;
  if (n('repeat_count') > n('existing_treatment_count')) {
    return NextResponse.json(
      { error: 'リピート件数は既存施術件数を超えられません' },
      { status: 400 },
    );
  }
  const mediaChecks: [string, string, string][] = [
    ['hpb_repeat_count', 'hpb_existing_count', 'ホットペッパー'],
    ['meta_repeat_count', 'meta_existing_count', 'Meta 広告'],
    ['minimo_repeat_count', 'minimo_existing_count', 'minimo'],
    ['referral_repeat_count', 'referral_existing_count', '紹介'],
  ];
  for (const [r, e, label] of mediaChecks) {
    if (n(r) > n(e)) {
      return NextResponse.json(
        { error: `${label}: リピートが既存件数を超えています` },
        { status: 400 },
      );
    }
  }
  const mediaExisting =
    n('hpb_existing_count') + n('meta_existing_count') + n('minimo_existing_count') + n('referral_existing_count');
  const mediaRepeat =
    n('hpb_repeat_count') + n('meta_repeat_count') + n('minimo_repeat_count') + n('referral_repeat_count');
  if (mediaExisting > n('existing_treatment_count') || mediaRepeat > n('repeat_count')) {
    return NextResponse.json(
      { error: '媒体別の合計が総数を超えています' },
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
