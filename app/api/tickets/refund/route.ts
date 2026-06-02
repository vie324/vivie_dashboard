import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

// 回数券を返金 (ステータスを refunded に)
export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from('staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = (actor as any)?.role;
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { ticket_id, reason } = body;
  if (!ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });

  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refunded_by: user.id,
      refund_reason: reason || null,
    })
    .eq('id', ticket_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit(supabase, {
    action: 'ticket.refund',
    entity: 'ticket',
    entityId: ticket_id,
    actorId: user.id,
    details: { reason: reason || null },
  });
  return NextResponse.json({ ok: true });
}
