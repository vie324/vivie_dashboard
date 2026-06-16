import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { GoalsClient } from '@/components/goals/goals-client';
import { GoalProgressCard } from '@/components/dashboard/goal-progress-card';
import { getGoalProgress } from '@/lib/goals';
import { todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role === 'staff' || staff.role === 'store') redirect('/');

  const supabase = createClient();
  const currentMonth = todayISO().slice(0, 7);
  const [{ data: stores }, { data: goals }] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('monthly_goals')
      .select('*, store:stores(name)')
      .order('goal_month', { ascending: false })
      .limit(24),
  ]);

  const storeList = (stores ?? []) as { id: string; name: string }[];
  // 当月の達成状況 (全店舗 + 店舗別)
  const [allProgress, ...storeProgresses] = await Promise.all([
    getGoalProgress(supabase, { month: currentMonth }),
    ...storeList.map((s) => getGoalProgress(supabase, { month: currentMonth, storeId: s.id })),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-4xl">
      <PageHeader
        title="目標管理"
        description="AI が過去の日報から次月の目標を提案します。手動編集も可能"
      />

      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink-900">今月の達成状況</h2>
          <p className="text-xs text-ink-500">
            設定済みの目標に対する、当月の日報・売上の実績です
          </p>
        </div>
        <GoalProgressCard progress={allProgress} title="達成状況 (全店舗)" />
        {storeList.length > 1 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {storeList.map((s, i) => (
              <GoalProgressCard
                key={s.id}
                progress={storeProgresses[i]}
                title="店舗別"
                storeName={s.name}
              />
            ))}
          </div>
        )}
      </section>

      <GoalsClient stores={storeList as any} goals={(goals ?? []) as any} />
    </div>
  );
}
