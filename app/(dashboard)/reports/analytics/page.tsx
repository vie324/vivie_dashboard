import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { getGoalProgress, getRepeatRateByStaff, MEDIA_LABELS, type MediaKey } from '@/lib/goals';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Users, Megaphone, Activity } from 'lucide-react';
import { formatYen, todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function rateTone(rate: number): 'green' | 'amber' | 'default' {
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
    getRepeatRateByStaff(supabase, { month }),
    getGoalProgress(supabase, { month }),
    supabase
      .from('repeat_rate_by_media_derived')
      .select('*')
      .eq('month', month)
      .order('total_visits', { ascending: false }),
  ]);

  const a = progress.actuals;
  const mediaRows = (Object.keys(MEDIA_LABELS) as MediaKey[]).map((key) => ({
    key,
    label: MEDIA_LABELS[key],
    ...a.repeatByMedia[key],
  }));
  const mediaHasData = mediaRows.some((m) => m.existing > 0);
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
        title="リピート率分析"
        description={`${month} のリピート率をスタッフ別・媒体別に可視化します`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryStat label="全体リピート率" value={`${a.repeatRate}%`} hint={`既存 ${a.existing} / リピート ${a.repeat}`} />
        <SummaryStat label="日報件数" value={`${a.reportCount} 件`} />
        <SummaryStat label="日報売上 (自己申告)" value={formatYen(a.sales)} />
      </div>

      {/* スタッフ別 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} className="text-vivie-500" />
            スタッフ別 リピート率
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">日報の既存施術件数・リピート件数をスタッフごとに集計</p>
        </CardHeader>
        <CardContent className="p-0">
          {byStaff.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400 text-center">この月の日報がありません</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>スタッフ</th>
                  <th className="text-right">既存</th>
                  <th className="text-right">リピート</th>
                  <th className="text-right">リピート率</th>
                  <th className="text-right">売上</th>
                  <th>進捗</th>
                </tr>
              </thead>
              <tbody>
                {byStaff.map((s) => (
                  <tr key={s.staffId}>
                    <td className="font-medium">{s.staffName}</td>
                    <td className="text-right">{s.existing}</td>
                    <td className="text-right">{s.repeat}</td>
                    <td className="text-right font-medium">
                      <Badge tone={rateTone(s.repeatRate)}>{s.repeatRate}%</Badge>
                    </td>
                    <td className="text-right text-ink-600">{formatYen(s.sales)}</td>
                    <td>
                      <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                        <div
                          className="h-full bg-vivie-400"
                          style={{ width: `${Math.min(100, s.repeatRate)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 媒体別 (日報の手動内訳) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone size={18} className="text-vivie-500" />
            媒体別 リピート率 (日報入力ベース)
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            日報の「媒体別リピート内訳」で入力された既存/リピート件数を集計
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {!mediaHasData ? (
            <p className="px-5 py-6 text-sm text-ink-400 text-center">
              媒体別の内訳がまだ入力されていません。日報の「媒体別リピート内訳 (任意)」に入力すると集計されます。
            </p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>媒体</th>
                  <th className="text-right">既存</th>
                  <th className="text-right">リピート</th>
                  <th className="text-right">リピート率</th>
                  <th>進捗</th>
                </tr>
              </thead>
              <tbody>
                {mediaRows.map((m) => (
                  <tr key={m.key}>
                    <td className="font-medium">{m.label}</td>
                    <td className="text-right">{m.existing}</td>
                    <td className="text-right">{m.repeat}</td>
                    <td className="text-right font-medium">
                      <Badge tone={rateTone(m.rate)}>{m.rate}%</Badge>
                    </td>
                    <td>
                      <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                        <div
                          className="h-full bg-vivie-400"
                          style={{ width: `${Math.min(100, m.rate)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 媒体別 (来店履歴からの派生 = 参考値) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={18} className="text-vivie-500" />
            媒体別 リピート率 (来店履歴ベース・参考)
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            会員の獲得媒体 × 施術レポート(来店)から自動算出した参考値。再来(初回でない来店)の割合です。
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {derivedRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400 text-center">
              この月の来店データがありません (施術レポートが登録されると集計されます)
            </p>
          ) : (
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
                      <Badge tone={rateTone(Number(d.repeat_rate))}>{d.repeat_rate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
