import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { GoalsClient } from '@/components/goals/goals-client';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role === 'staff' || staff.role === 'store') redirect('/');

  const supabase = createClient();
  const [{ data: stores }, { data: goals }] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('monthly_goals')
      .select('*, store:stores(name)')
      .order('goal_month', { ascending: false })
      .limit(24),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-4xl">
      <PageHeader
        title="目標管理"
        description="AI が過去の日報から次月の目標を提案します。手動編集も可能"
      />
      <GoalsClient stores={(stores ?? []) as any} goals={(goals ?? []) as any} />
    </div>
  );
}
