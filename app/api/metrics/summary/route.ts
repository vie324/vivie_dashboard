import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { todayISO, monthRange } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ダッシュボードの期間別 KPI を返す。期間タブ (今日/今週/今月/先月) の切り替えで
// クライアントから from/to (YYYY-MM-DD, 両端含む) を指定して再取得する。
export type MetricsSummary = {
  from: string;
  to: string;
  totalMembers: number;
  activeMembers: number;
  activeSubs: number;
  income: number;
  subscriptionIncome: number;
  ticketIncome: number;
  otherIncome: number;
  expense: number;
  newCount: number;
  contractCount: number;
  contractRate: number;
  existing: number;
  repeat: number;
  repeatRate: number;
};

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const defMonth = monthRange(todayISO().slice(0, 7));
  const from = sp.get('from') || defMonth.start;
  const to = sp.get('to') || todayISO();

  const [membersRes, activeMembersRes, activeSubsRes, cashRes, reportRes] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('member_subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ACTIVE', 'active']),
    supabase
      .from('cashbook_entries')
      .select('amount, entry_type, sale_kind')
      .gte('entry_date', from)
      .lte('entry_date', to),
    supabase
      .from('daily_reports')
      .select(
        'existing_treatment_count, repeat_count, hpb_new_count, hpb_contract_count,' +
          ' meta_new_count, meta_contract_count, minimo_new_count, minimo_contract_count,' +
          ' referral_new_count, referral_contract_count',
      )
      .gte('report_date', from)
      .lte('report_date', to),
  ]);

  const cash = (cashRes.data ?? []) as {
    amount: number;
    entry_type: string;
    sale_kind: string | null;
  }[];
  const income = cash.filter((e) => e.entry_type === 'income');
  const totalIncome = income.reduce((s, e) => s + e.amount, 0);
  const subscriptionIncome = income
    .filter((e) => e.sale_kind === 'subscription')
    .reduce((s, e) => s + e.amount, 0);
  const ticketIncome = income
    .filter((e) => e.sale_kind === 'ticket')
    .reduce((s, e) => s + e.amount, 0);
  const expense = cash
    .filter((e) => e.entry_type === 'expense')
    .reduce((s, e) => s + e.amount, 0);

  const reports = (reportRes.data ?? []) as any[];
  const sumCol = (col: string) => reports.reduce((s: number, r: any) => s + (r[col] ?? 0), 0);
  const existing = sumCol('existing_treatment_count');
  const repeat = sumCol('repeat_count');
  const newCount =
    sumCol('hpb_new_count') +
    sumCol('meta_new_count') +
    sumCol('minimo_new_count') +
    sumCol('referral_new_count');
  const contractCount =
    sumCol('hpb_contract_count') +
    sumCol('meta_contract_count') +
    sumCol('minimo_contract_count') +
    sumCol('referral_contract_count');

  const payload: MetricsSummary = {
    from,
    to,
    totalMembers: membersRes.count ?? 0,
    activeMembers: activeMembersRes.count ?? 0,
    activeSubs: activeSubsRes.count ?? 0,
    income: totalIncome,
    subscriptionIncome,
    ticketIncome,
    otherIncome: totalIncome - subscriptionIncome - ticketIncome,
    expense,
    newCount,
    contractCount,
    contractRate: newCount > 0 ? Math.round((contractCount / newCount) * 100) : 0,
    existing,
    repeat,
    repeatRate: existing > 0 ? Math.round((repeat / existing) * 100) : 0,
  };

  return NextResponse.json(payload);
}
