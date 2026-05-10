import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const userId = decodeURIComponent(params.userId);
  const patch: Record<string, any> = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.pinned !== undefined) patch.pinned = !!body.pinned;
  if (body.assignee_id !== undefined) patch.assignee_id = body.assignee_id || null;
  if (body.internal_notes !== undefined) patch.internal_notes = body.internal_notes;

  // 'handled' に切り替わる時は last_handled_* も記録
  if (body.status === 'handled') {
    patch.last_handled_at = new Date().toISOString();
    patch.last_handled_by = user.id;
  }

  const { error } = await supabase.from('line_conversation_meta').upsert(
    {
      line_user_id: userId,
      ...patch,
    },
    { onConflict: 'line_user_id' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
