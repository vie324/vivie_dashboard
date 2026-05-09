import { createClient } from '@/lib/supabase/server';
import type { Staff } from '@/types/database';

export async function getCurrentStaff(): Promise<Staff | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('staff').select('*').eq('id', user.id).maybeSingle();
  return (data as Staff | null) ?? null;
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
