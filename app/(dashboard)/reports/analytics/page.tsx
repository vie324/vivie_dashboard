import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { getGoalProgress, getStaffPerformance, MEDIA_LABELS, type MediaKey } from '@/lib/goals';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Users, Megaphone, Repeat, Lightbulb } from 'lucide-react';
import { formatYen, todayISO } from '@/lib/utils';
import { MonthPicker } from '@/components/dashboard/month-picker';
import { RateBarChart } from '@/components/reports/rate-bar-chart';

export const dynamic = 'force-dynamic';

// 契約率 (新規→契約) のトーン。契約率は一般に 20〜40% 程度。
function contractTone(rate: number): 'green' | 'amber' | 'default' {
  if (rate >= 40) return 'green';
  if (rate >= 20) return 'amber';
  return 'default';
}
function repeatTone(rate: number): 'green' | 'amber' | 'default' {
  if (rate >= 60) return 'green';
  if (rate >= 40) return 'amber';
  return 'default';
}

export default async function ReportsAnalyticsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/reports');

  const supabase = createClient();
  const month = searchParams.month ?? todayISO().slice(0, 7);

  const [byStaff, progress, { data: derived }] = await Promise.all([
    getStaffPerformance(supabase, { month }),
    getGoalProgress(supabase, { month }),
    supabase
      .from('repeat_rate_by_media_derived')
      .select('*')
      .eq('month', month)
      .order('total_visits', { ascending: false }),
  ]);

  const a = progress.actuals;
  const mediaKeys = Object.keys(MEDIA_LABELS) as MediaKey[];

  // --- 契約率 (主指標) ---
  const mediaContractRows = mediaKeys.map((key) => ({
    key,
    label: MEDIA_LABELS[key],
    ...a.contractByMedia[key],
  }));
  const contractHasData = mediaContractRows.some((m) => m.newCount > 0);
  const mediaContractBars = mediaContractRows
    .filter((m) => m.newCount > 0)
    .map((m) => ({ name: m.label, rate: m.rate, numerator: m.contract, denominator: m.newCount }));

  const staffContractRows = byStaff.filter((s) => s.newCount > 0);
  const staffContractBars = staffContractRows.map((s) => ({
    name: s.staffName,
    rate: s.contractRate,
    numerator: s.contract,
    denominator: s.newCount,
  }));

  // --- 再来率 (参考) ---
  const mediaRepeatRows = mediaKeys.map((key) => ({ key, label: MEDIA_LABELS[key], ...a.repeatByMedia[key] }));
  const repeatHasData = mediaRepeatRows.some((m) => m.existing > 0);
  const mediaRepeatBars = mediaRepeatRows
    .filter((m) => m.existing > 0)
    .map((m) => ({ name: m.label, rate: m.rate, numerator: m.repeat, denominator: m.existing }));
  const staffRepeatRows = byStaff.filter((s) => s.existing > 0);
  const derivedRows = (derived ?? []) as any[];

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        日報一覧に戻る
      </Link>
      <PageHeader
        title="集客・契約分析"
        description="新規からの契約率を媒体別・スタッフ別に可視化し、広告予算の配分を判断します"
        actions={<MonthPicker value={month} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryStat label="新規来店数" value={`${a.newTotal} 名`} hint="日報の媒体別 新規の合計" />
        <SummaryStat label="契約数" value={`${a.contractTotal} 件`} />
        <SummaryStat label="契約率 (全体)" value={`${a.contractRate}%`} hint="契約数 ÷ 新規来店数" />
      </div>

      {/* 媒体別 契約率 (主指標) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone size={18} className="text-vivie-500" />
            媒体別 契約率
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">どの集客媒体が契約に繋がっているか (日報の新規/契約ベース)</p>
        </CardHeader>
        <CardContent className="p-0">
          {!contractHasData ? (
            <p className="px-5 py-6 text-sm text-ink-400 text-center">
              この月の新規来店の記録がありません。日報の「新規集客 (媒体ごとの来店/契約)」を入力すると集計されます。
            </p>
          ) : (
            <>
              <div className="px-4 pt-4">
                <RateBarChart data={mediaContractBars} numeratorLabel="契約" denominatorLabel="新規" />
              </div>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>媒体</th>
                    <th className="text-right">新規</th>
                    <th className="text-right">契約</th>
                    <th className="text-right">契約率</th>
                    <th>進捗</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaContractRows.map((m) => (
                    <tr key={m.key} className={m.newCount === 0 ? 'opacity-40' : ''}>
                      <td className="font-medium">{m.label}</td>
                      <td className="text-right">{m.newCount}</td>
                      <td className="text-right">{m.contract}</td>
                      <td className="text-right font-medium">
                        <Badge tone={contractTone(m.rate)}>{m.rate}%</Badge>
                      </td>
                      <td>
                        <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                          <div className="h-full bg-vivie-400" style={{ width: `${Math.min(100, m.rate)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-start gap-2 border-t border-ink-100 bg-vivie-50/40 px-5 py-3 text-xs text-ink-600">
                <Lightbulb size={14} className="text-vivie-500 mt-0.5 shrink-0" />
                <p>
                  新規が多く<strong>契約率も高い</strong>媒体は予算を増やす好機。新規は多いが
                  <strong>契約率が低い</strong>媒体は、接客・提案やプラン設計の見直しで改善余地があります。
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* スタッフ別 契約率 (主指標) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} className="text-vivie-500" />
            スタッフ別 契約率
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">担当ごとの新規→契約の決定力 (日報ベース)</p>
        </CardHeader>
        <CardContent className="p-0">
          {staffContractRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400 text-center">この月の新規対応の記録がありません</p>
          ) : (
            <>
              <div className="px-4 pt-4">
                <RateBarChart data={staffContractBars} numeratorLabel="契約" denominatorLabel="新規" />
              </div>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>スタッフ</th>
                    <th className="text-right">新規</th>
                    <th className="text-right">契約</th>
                    <th className="text-right">契約率</th>
                    <th className="text-right">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {staffContractRows.map((s) => (
                    <tr key={s.staffId}>
                      <td className="font-medium">{s.staffName}</td>
                      <td className="text-right">{s.newCount}</td>
                      <td className="text-right">{s.contract}</td>
                      <td className="text-right font-medium">
                        <Badge tone={contractTone(s.contractRate)}>{s.contractRate}%</Badge>
                      </td>
                      <td className="text-right text-ink-600">{formatYen(s.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </CardContent>
      </Card>

      {/* 参考: 再来率 (既存顧客の再来) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat size={18} className="text-ink-400" />
            （参考）再来率
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            既存のお客様が再び来店した割合です（契約率とは別の指標）。全体 {a.repeatRate}%（既存 {a.existing} / 再来 {a.repeat}）。
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 媒体別 再来率 (日報入力) */}
          <div>
            <p className="text-xs font-medium text-ink-500 mb-2">媒体別 再来率（日報の「媒体別リピート内訳」入力ベース）</p>
            {!repeatHasData ? (
              <p className="text-sm text-ink-400">媒体別の内訳は未入力です（任意項目）。</p>
            ) : (
              <RateBarChart data={mediaRepeatBars} numeratorLabel="再来" denominatorLabel="既存" />
            )}
          </div>

          {/* スタッフ別 再来率 */}
          {staffRepeatRows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-500 mb-2">スタッフ別 再来率</p>
              <div className="flex flex-wrap gap-2">
                {staffRepeatRows.map((s) => (
                  <span key={s.staffId} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-50 px-3 py-1.5 text-sm">
                    <span className="text-ink-700">{s.staffName}</span>
                    <Badge tone={repeatTone(s.repeatRate)}>{s.repeatRate}%</Badge>
                    <span className="text-[11px] text-ink-400">({s.repeat}/{s.existing})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 媒体別 再来率 (来店履歴からの派生) */}
          {derivedRows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-500 mb-2">獲得媒体別 再来率（来店履歴からの自動算出・参考）</p>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>獲得媒体</th>
                      <th className="text-right">来店</th>
                      <th className="text-right">初回</th>
                      <th className="text-right">再来</th>
                      <th className="text-right">再来率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivedRows.map((d) => (
                      <tr key={d.channel}>
                        <td className="font-medium">{d.channel}</td>
                        <td className="text-right">{d.total_visits}</td>
                        <td className="text-right">{d.first_visits}</td>
                        <td className="text-right">{d.repeat_visits}</td>
                        <td className="text-right font-medium">
                          <Badge tone={repeatTone(Number(d.repeat_rate))}>{d.repeat_rate}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
