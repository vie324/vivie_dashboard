import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// 回数券を 1 回消費
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

  const { ticket_id, treatment_report_id, menu, notes } = body;
  if (!ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('use_ticket', {
    p_ticket_id: ticket_id,
    p_staff_id: user.id,
    p_treatment_report_id: treatment_report_id || null,
    p_menu: menu || null,
    p_notes: notes || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as any;
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error ?? '使用に失敗しました' }, { status: 400 });
  }
  return NextResponse.json(result);
}
