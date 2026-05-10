import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CounselingAnalyticsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/counseling');

  const supabase = createClient();
  const [{ data: byChannel }, { data: byStaff }, { data: visitReasonsData }, { data: noContractData }] = await Promise.all([
    supabase.from('counseling_marketing_summary').select('*'),
    supabase.from('counseling_staff_summary').select('*'),
    supabase.from('counseling_records').select('visit_reasons, acquisition_channel, contract_plan').limit(2000),
    supabase
      .from('counseling_records')
      .select('no_contract_reason, closing_status_raw')
      .not('no_contract_reason', 'is', null)
      .limit(2000),
  ]);

  // 来店動機 × 媒体クロス集計 (上位)
  const reasonCounts = new Map<string, { total: number; contracted: number }>();
  for (const r of (visitReasonsData ?? []) as any[]) {
    for (const reason of r.visit_reasons ?? []) {
      const cur = reasonCounts.get(reason) ?? { total: 0, contracted: 0 };
      cur.total++;
      if (r.contract_plan) cur.contracted++;
      reasonCounts.set(reason, cur);
    }
  }
  const reasons = Array.from(reasonCounts.entries())
    .map(([name, v]) => ({
      name,
      ...v,
      rate: v.total > 0 ? Math.round((v.contracted / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // 未契約理由トップ
  const noContractCounts = new Map<string, number>();
  for (const r of (noContractData ?? []) as any[]) {
    const reason = (r.no_contract_reason ?? r.closing_status_raw ?? '').trim();
    if (!reason) continue;
    noContractCounts.set(reason, (noContractCounts.get(reason) ?? 0) + 1);
  }
  const topNoContract = Array.from(noContractCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <Link
        href="/counseling"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        一覧に戻る
      </Link>
      <PageHeader title="カウンセリング分析" description="媒体別 / 担当別 / 来店動機 別の契約率を可視化" />

      {/* 媒体別契約率 */}
      <Card>
        <CardHeader>
          <CardTitle>媒体別 契約率</CardTitle>
          <p className="text-xs text-ink-500 mt-1">acquisition_channel ベース</p>
        </CardHeader>
        <CardContent className="p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>媒体</th>
                <th className="text-right">来店</th>
                <th className="text-right">契約</th>
                <th className="text-right">契約率</th>
                <th>進捗</th>
              </tr>
            </thead>
            <tbody>
              {(byChannel ?? []).map((c: any) => (
                <tr key={c.acquisition_channel}>
                  <td className="font-medium">{c.acquisition_channel}</td>
                  <td className="text-right">{c.total}</td>
                  <td className="text-right">{c.contracted}</td>
                  <td className="text-right font-medium">
                    <Badge tone={c.contract_rate >= 30 ? 'green' : c.contract_rate >= 15 ? 'amber' : 'default'}>
                      {c.contract_rate}%
                    </Badge>
                  </td>
                  <td>
                    <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full bg-vivie-400"
                        style={{ width: `${Math.min(100, c.contract_rate)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 担当別契約率 */}
      <Card>
        <CardHeader>
          <CardTitle>担当別 契約率</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>担当</th>
                <th className="text-right">対応</th>
                <th className="text-right">契約</th>
                <th className="text-right">契約率</th>
              </tr>
            </thead>
            <tbody>
              {(byStaff ?? []).map((s: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">
                    {s.staff_name ?? <span className="text-ink-400">{s.raw_name} (未紐付)</span>}
                  </td>
                  <td className="text-right">{s.total}</td>
                  <td className="text-right">{s.contracted}</td>
                  <td className="text-right font-medium">
                    <Badge tone={s.contract_rate >= 30 ? 'green' : s.contract_rate >= 15 ? 'amber' : 'default'}>
                      {s.contract_rate}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 来店動機 */}
        <Card>
          <CardHeader>
            <CardTitle>来店動機 別 契約率</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>動機</th>
                  <th className="text-right">件数</th>
                  <th className="text-right">契約率</th>
                </tr>
              </thead>
              <tbody>
                {reasons.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="text-right">{r.total}</td>
                    <td className="text-right">{r.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 未契約理由 */}
        <Card>
          <CardHeader>
            <CardTitle>未契約理由 トップ</CardTitle>
            <p className="text-xs text-ink-500 mt-1">無契約・検討理由の集計</p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>理由</th>
                  <th className="text-right">件数</th>
                </tr>
              </thead>
              <tbody>
                {topNoContract.map((r) => (
                  <tr key={r.name}>
                    <td className="text-sm">{r.name}</td>
                    <td className="text-right">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
