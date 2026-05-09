import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Staff } from '@/types/database';

// staff レコードを取得。auth.users にはあるが staff にない場合は自動作成。
// (マイグレーションのトリガーが未実行な環境でもログイン後に動くように保険)
export async function getCurrentStaff(): Promise<Staff | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('staff').select('*').eq('id', user.id).maybeSingle();
  if (data) return data as Staff;

  if (!user.email) return null;

  // フォールバック: service role で staff レコードを作成
  try {
    const service = createServiceClient();
    // 既存の admin がいなければ最初のユーザーを admin にする
    const { count } = await service
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    const role = (count ?? 0) === 0 ? 'admin' : 'staff';

    const token = crypto.randomBytes(24).toString('hex');
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      user.email.split('@')[0];

    const { data: created } = await service
      .from('staff')
      .insert({
        id: user.id,
        email: user.email,
        display_name: displayName,
        role,
        is_active: true,
        daily_report_token: token,
      })
      .select('*')
      .single();
    return (created as Staff | null) ?? null;
  } catch (err) {
    console.error('failed to auto-create staff record', err);
    return null;
  }
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error('Unauthorized');
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== 'admin') throw new Error('Forbidden');
  return staff;
}

export async function requireManager(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== 'admin' && staff.role !== 'manager') {
    throw new Error('Forbidden');
  }
  return staff;
}
