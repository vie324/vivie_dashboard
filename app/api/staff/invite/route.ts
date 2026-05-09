import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// admin 権限のスタッフが新規スタッフを作成
// Supabase Auth のユーザー作成 + staff レコード作成を一括実行
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
  if ((actor as any)?.role !== 'admin') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { email, password, display_name, role, primary_store_id } = body;
  if (!email || !password || !display_name) {
    return NextResponse.json(
      { error: 'email / password / display_name は必須です' },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'パスワードは 8 文字以上にしてください' },
      { status: 400 },
    );
  }
  const allowedRoles = ['admin', 'manager', 'staff'];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: '不正な役割です' }, { status: 400 });
  }

  // 1) auth.users 作成
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  });
  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'ユーザー作成に失敗しました' },
      { status: 500 },
    );
  }

  // 2) staff レコードを更新 (トリガーで作成済みの可能性高)
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const { error: upsertError } = await supabase
    .from('staff')
    .upsert(
      {
        id: created.user.id,
        email,
        display_name,
        role,
        primary_store_id: primary_store_id || null,
        is_active: true,
        daily_report_token: token,
      },
      { onConflict: 'id' },
    );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, staff_id: created.user.id });
}
