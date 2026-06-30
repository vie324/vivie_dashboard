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

export type MediaKey = 'hpb' | 'meta' | 'minimo' | 'referral';

export const MEDIA_LABELS: Record<MediaKey, string> = {
  hpb: 'ホットペッパー',
  meta: 'Meta 広告',
  minimo: 'minimo',
  referral: '紹介',
};

export type RepeatByMedia = Record<
  MediaKey,
  { existing: number; repeat: number; rate: number }
>;

// 媒体別の契約率 (新規来店 → 契約)。広告予算配分の判断に使う主指標。
export type ContractByMedia = Record<
  MediaKey,
  { newCount: number; contract: number; rate: number }
>;

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
  // 全体契約率 (= contractTotal / newTotal)
  contractRate: number;
  // 媒体別の新規/契約/契約率
  contractByMedia: ContractByMedia;
  sales: number;
  existing: number;
  repeat: number;
  repeatRate: number;
  // 媒体別の既存/リピート内訳 (日報の任意入力ベース。参考: 再来率)
  repeatByMedia: RepeatByMedia;
  reportCount: number;
};

// スタッフ別の実績 (日報ベース)。契約率を主指標に、再来率は参考。
export type StaffPerformance = {
  staffId: string;
  staffName: string;
  newCount: number;
  contract: number;
  contractRate: number;
  existing: number;
  repeat: number;
  repeatRate: number;
  sales: number;
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
// 媒体別の既存/リピート列 (後発マイグレーション)。未適用環境ではフォールバックする。
const REPORT_COLUMNS_FULL =
  REPORT_COLUMNS_MINIMO +
  ', hpb_existing_count, hpb_repeat_count, meta_existing_count, meta_repeat_count' +
  ', minimo_existing_count, minimo_repeat_count, referral_existing_count, referral_repeat_count';

function emptyRepeatByMedia(): RepeatByMedia {
  return {
    hpb: { existing: 0, repeat: 0, rate: 0 },
    meta: { existing: 0, repeat: 0, rate: 0 },
    minimo: { existing: 0, repeat: 0, rate: 0 },
    referral: { existing: 0, repeat: 0, rate: 0 },
  };
}

function emptyContractByMedia(): ContractByMedia {
  return {
    hpb: { newCount: 0, contract: 0, rate: 0 },
    meta: { newCount: 0, contract: 0, rate: 0 },
    minimo: { newCount: 0, contract: 0, rate: 0 },
    referral: { newCount: 0, contract: 0, rate: 0 },
  };
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

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
    contractRate: 0,
    contractByMedia: emptyContractByMedia(),
    sales: 0,
    existing: 0,
    repeat: 0,
    repeatRate: 0,
    repeatByMedia: emptyRepeatByMedia(),
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
    // リピート率は加算できないので平均を取る。未設定 (0) の店舗は分母から除外しないと
    // 設定済み店舗の目標が薄まってしまうため、target > 0 の行だけで平均する。
    repeat_rate_target: (() => {
      const set = rows.filter((g) => (g.repeat_rate_target ?? 0) > 0);
      if (set.length === 0) return 0;
      return Math.round(
        set.reduce((s, g) => s + (g.repeat_rate_target ?? 0), 0) / set.length,
      );
    })(),
  };
}

export async function getGoalProgress(
  supabase: SupabaseClient<Database>,
  opts: { month: string; storeId?: string | null; staffId?: string | null },
): Promise<GoalProgress> {
  const month = opts.month;
  const storeId = opts.storeId ?? null;
  const staffId = opts.staffId ?? null;
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

  // --- 当月の日報を集計 (後発カラムは無い環境では段階的にフォールバック) ---
  async function fetchReports(columns: string) {
    const q = supabase
      .from('daily_reports')
      .select(columns)
      .gte('report_date', start)
      .lt('report_date', endExclusive);
    if (storeId) q.eq('store_id', storeId);
    if (staffId) q.eq('staff_id', staffId);
    return q;
  }

  // FULL (媒体別リピート列込み) → MINIMO → BASE の順にフォールバック
  let reports: any[] | null = null;
  let minimoSupported = true;
  let mediaRepeatSupported = true;
  {
    const full = await fetchReports(REPORT_COLUMNS_FULL);
    if (!full.error) {
      reports = full.data as any[];
    } else {
      mediaRepeatSupported = false;
      const minimo = await fetchReports(REPORT_COLUMNS_MINIMO);
      if (!minimo.error) {
        reports = minimo.data as any[];
      } else {
        minimoSupported = false;
        const base = await fetchReports(REPORT_COLUMNS_BASE);
        reports = base.data as any[];
      }
    }
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
    if (mediaRepeatSupported) {
      a.repeatByMedia.hpb.existing += r.hpb_existing_count ?? 0;
      a.repeatByMedia.hpb.repeat += r.hpb_repeat_count ?? 0;
      a.repeatByMedia.meta.existing += r.meta_existing_count ?? 0;
      a.repeatByMedia.meta.repeat += r.meta_repeat_count ?? 0;
      a.repeatByMedia.minimo.existing += r.minimo_existing_count ?? 0;
      a.repeatByMedia.minimo.repeat += r.minimo_repeat_count ?? 0;
      a.repeatByMedia.referral.existing += r.referral_existing_count ?? 0;
      a.repeatByMedia.referral.repeat += r.referral_repeat_count ?? 0;
    }
    a.sales += r.total_sales ?? 0;
    a.existing += r.existing_treatment_count ?? 0;
    a.repeat += r.repeat_count ?? 0;
    a.reportCount += 1;
  }
  a.newTotal = a.hpbNew + a.metaNew + a.minimoNew + a.referralNew;
  a.contractTotal = a.hpbContract + a.metaContract + a.minimoContract + a.referralContract;
  a.contractRate = rate(a.contractTotal, a.newTotal);
  a.repeatRate = rate(a.repeat, a.existing);
  // 媒体別の新規/契約/契約率
  a.contractByMedia = {
    hpb: { newCount: a.hpbNew, contract: a.hpbContract, rate: rate(a.hpbContract, a.hpbNew) },
    meta: { newCount: a.metaNew, contract: a.metaContract, rate: rate(a.metaContract, a.metaNew) },
    minimo: { newCount: a.minimoNew, contract: a.minimoContract, rate: rate(a.minimoContract, a.minimoNew) },
    referral: { newCount: a.referralNew, contract: a.referralContract, rate: rate(a.referralContract, a.referralNew) },
  };
  for (const key of Object.keys(a.repeatByMedia) as MediaKey[]) {
    const m = a.repeatByMedia[key];
    m.rate = rate(m.repeat, m.existing);
  }

  // minimo 列が無い環境では minimo の目標も分母から外し、達成率を歪めない
  const newTarget = goal
    ? (goal.hpb_new_target ?? 0) +
      (goal.meta_new_target ?? 0) +
      (minimoSupported ? goal.minimo_new_target ?? 0 : 0) +
      (goal.referral_new_target ?? 0)
    : 0;

  const metrics: GoalMetric[] = [
    { key: 'new', label: '新規来店', actual: a.newTotal, target: newTarget, unit: 'count' },
    { key: 'contract', label: '契約', actual: a.contractTotal, target: goal?.contract_target ?? 0, unit: 'count' },
    { key: 'contractRate', label: '契約率', actual: a.contractRate, target: 0, unit: 'percent' },
    { key: 'sales', label: '売上', actual: a.sales, target: goal?.sales_target ?? 0, unit: 'yen' },
    { key: 'repeat', label: '再来率 (参考)', actual: a.repeatRate, target: goal?.repeat_rate_target ?? 0, unit: 'percent' },
  ];

  return { month, storeId, goal, goalScope, actuals: a, metrics };
}

// スタッフ別の実績 (契約率を主指標に、再来率は参考) を日報から集計する。
// 新規/契約は媒体別カラム (init から存在) の合算なので #43 マイグレーション未適用でも動く。
export async function getStaffPerformance(
  supabase: SupabaseClient<Database>,
  opts: { month: string; storeId?: string | null },
): Promise<StaffPerformance[]> {
  const { start, endExclusive } = monthRange(opts.month);
  const columns =
    'staff_id, hpb_new_count, hpb_contract_count, meta_new_count, meta_contract_count,' +
    ' minimo_new_count, minimo_contract_count, referral_new_count, referral_contract_count,' +
    ' existing_treatment_count, repeat_count, total_sales, staff:staff(display_name)';
  let q = supabase
    .from('daily_reports')
    .select(columns)
    .gte('report_date', start)
    .lt('report_date', endExclusive);
  if (opts.storeId) q = q.eq('store_id', opts.storeId);
  const { data } = await q;

  const map = new Map<string, StaffPerformance>();
  for (const r of (data ?? []) as any[]) {
    const id = r.staff_id as string;
    const cur =
      map.get(id) ??
      {
        staffId: id,
        staffName: r.staff?.display_name ?? '—',
        newCount: 0,
        contract: 0,
        contractRate: 0,
        existing: 0,
        repeat: 0,
        repeatRate: 0,
        sales: 0,
        reportCount: 0,
      };
    cur.newCount +=
      (r.hpb_new_count ?? 0) +
      (r.meta_new_count ?? 0) +
      (r.minimo_new_count ?? 0) +
      (r.referral_new_count ?? 0);
    cur.contract +=
      (r.hpb_contract_count ?? 0) +
      (r.meta_contract_count ?? 0) +
      (r.minimo_contract_count ?? 0) +
      (r.referral_contract_count ?? 0);
    cur.existing += r.existing_treatment_count ?? 0;
    cur.repeat += r.repeat_count ?? 0;
    cur.sales += r.total_sales ?? 0;
    cur.reportCount += 1;
    map.set(id, cur);
  }
  const rows = Array.from(map.values());
  for (const row of rows) {
    row.contractRate = rate(row.contract, row.newCount);
    row.repeatRate = rate(row.repeat, row.existing);
  }
  // 新規が多い順 (広告予算判断で母数の大きいスタッフを上に)
  return rows.sort((x, y) => y.newCount - x.newCount);
}
