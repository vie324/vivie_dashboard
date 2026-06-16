import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MonthlyGoal } from '@/types/database';
import { monthRange } from '@/lib/utils';

// 目標 (monthly_goals) と当月の日報実績 (daily_reports) を突き合わせ、
// 達成状況を算出する共有ロジック。
// 管理ページ・ダッシュボード・店舗ページ・スタッフページから利用する。

export type GoalMetricUnit = 'count' | 'yen' | 'percent';

export type GoalMetric = {
  key: string;
  label: string;
  actual: number;
  target: number;
  unit: GoalMetricUnit;
};

export type GoalActuals = {
  hpbNew: number;
  metaNew: number;
  minimoNew: number;
  referralNew: number;
  newTotal: number;
  hpbContract: number;
  metaContract: number;
  minimoContract: number;
  referralContract: number;
  contractTotal: number;
  sales: number;
  existing: number;
  repeat: number;
  repeatRate: number;
  reportCount: number;
};

export type GoalProgress = {
  month: string; // YYYY-MM
  storeId: string | null;
  goal: MonthlyGoal | null;
  // 'store' = 店舗別目標, 'all' = 全店舗目標 (またはその合算)
  goalScope: 'store' | 'all' | null;
  actuals: GoalActuals;
  metrics: GoalMetric[];
};

const REPORT_COLUMNS_BASE =
  'hpb_new_count, hpb_contract_count, meta_new_count, meta_contract_count, referral_new_count, referral_contract_count, existing_treatment_count, repeat_count, total_sales';
const REPORT_COLUMNS_MINIMO = REPORT_COLUMNS_BASE + ', minimo_new_count, minimo_contract_count';

function emptyActuals(): GoalActuals {
  return {
    hpbNew: 0,
    metaNew: 0,
    minimoNew: 0,
    referralNew: 0,
    newTotal: 0,
    hpbContract: 0,
    metaContract: 0,
    minimoContract: 0,
    referralContract: 0,
    contractTotal: 0,
    sales: 0,
    existing: 0,
    repeat: 0,
    repeatRate: 0,
    reportCount: 0,
  };
}

// 複数の店舗別目標を 1 つの合算目標に畳み込む (全店舗目標が無い場合の代替)
function sumGoals(rows: MonthlyGoal[], month: string): MonthlyGoal {
  const base = rows[0];
  return {
    ...base,
    id: 'aggregate',
    store_id: null,
    goal_month: month,
    hpb_new_target: rows.reduce((s, g) => s + (g.hpb_new_target ?? 0), 0),
    meta_new_target: rows.reduce((s, g) => s + (g.meta_new_target ?? 0), 0),
    minimo_new_target: rows.reduce((s, g) => s + (g.minimo_new_target ?? 0), 0),
    referral_new_target: rows.reduce((s, g) => s + (g.referral_new_target ?? 0), 0),
    contract_target: rows.reduce((s, g) => s + (g.contract_target ?? 0), 0),
    sales_target: rows.reduce((s, g) => s + (g.sales_target ?? 0), 0),
    // リピート率は合算できないので平均を取る
    repeat_rate_target: Math.round(
      rows.reduce((s, g) => s + (g.repeat_rate_target ?? 0), 0) / rows.length,
    ),
  };
}

export async function getGoalProgress(
  supabase: SupabaseClient<Database>,
  opts: { month: string; storeId?: string | null },
): Promise<GoalProgress> {
  const month = opts.month;
  const storeId = opts.storeId ?? null;
  const { start, endExclusive } = monthRange(month);

  // --- 目標を取得 (店舗指定時は店舗別を優先し、無ければ全店舗をフォールバック) ---
  const { data: goalRows } = await supabase
    .from('monthly_goals')
    .select('*')
    .eq('goal_month', month);
  const rows = (goalRows ?? []) as MonthlyGoal[];

  let goal: MonthlyGoal | null = null;
  let goalScope: GoalProgress['goalScope'] = null;
  if (storeId) {
    const storeGoal = rows.find((g) => g.store_id === storeId);
    const allGoal = rows.find((g) => g.store_id === null);
    if (storeGoal) {
      goal = storeGoal;
      goalScope = 'store';
    } else if (allGoal) {
      goal = allGoal;
      goalScope = 'all';
    }
  } else {
    const allGoal = rows.find((g) => g.store_id === null);
    if (allGoal) {
      goal = allGoal;
      goalScope = 'all';
    } else if (rows.length > 0) {
      // 全店舗目標が無い場合は店舗別目標を合算
      goal = sumGoals(rows, month);
      goalScope = 'all';
    }
  }

  // --- 当月の日報を集計 (minimo カラムは後発のため、無い環境では除外して再試行) ---
  async function fetchReports(columns: string) {
    const q = supabase
      .from('daily_reports')
      .select(columns)
      .gte('report_date', start)
      .lt('report_date', endExclusive);
    if (storeId) q.eq('store_id', storeId);
    return q;
  }

  let { data: reports, error } = await fetchReports(REPORT_COLUMNS_MINIMO);
  let minimoSupported = !error;
  if (error) {
    const fallback = await fetchReports(REPORT_COLUMNS_BASE);
    reports = fallback.data;
    minimoSupported = false;
  }

  const a = emptyActuals();
  for (const r of (reports ?? []) as any[]) {
    a.hpbNew += r.hpb_new_count ?? 0;
    a.metaNew += r.meta_new_count ?? 0;
    a.referralNew += r.referral_new_count ?? 0;
    a.hpbContract += r.hpb_contract_count ?? 0;
    a.metaContract += r.meta_contract_count ?? 0;
    a.referralContract += r.referral_contract_count ?? 0;
    if (minimoSupported) {
      a.minimoNew += r.minimo_new_count ?? 0;
      a.minimoContract += r.minimo_contract_count ?? 0;
    }
    a.sales += r.total_sales ?? 0;
    a.existing += r.existing_treatment_count ?? 0;
    a.repeat += r.repeat_count ?? 0;
    a.reportCount += 1;
  }
  a.newTotal = a.hpbNew + a.metaNew + a.minimoNew + a.referralNew;
  a.contractTotal = a.hpbContract + a.metaContract + a.minimoContract + a.referralContract;
  a.repeatRate = a.existing > 0 ? Math.round((a.repeat / a.existing) * 100) : 0;

  const newTarget = goal
    ? (goal.hpb_new_target ?? 0) +
      (goal.meta_new_target ?? 0) +
      (goal.minimo_new_target ?? 0) +
      (goal.referral_new_target ?? 0)
    : 0;

  const metrics: GoalMetric[] = [
    { key: 'new', label: '新規来店', actual: a.newTotal, target: newTarget, unit: 'count' },
    { key: 'contract', label: '契約', actual: a.contractTotal, target: goal?.contract_target ?? 0, unit: 'count' },
    { key: 'sales', label: '売上', actual: a.sales, target: goal?.sales_target ?? 0, unit: 'yen' },
    { key: 'repeat', label: 'リピート率', actual: a.repeatRate, target: goal?.repeat_rate_target ?? 0, unit: 'percent' },
  ];

  return { month, storeId, goal, goalScope, actuals: a, metrics };
}
