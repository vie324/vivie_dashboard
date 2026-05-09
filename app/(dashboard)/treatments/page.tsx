import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList, Plus } from 'lucide-react';
import { formatDate, formatYen } from '@/lib/utils';
import { SKIN_AXES, FACE_AXES, avgScore } from '@/lib/treatment-axes';

export const dynamic = 'force-dynamic';

export default async function TreatmentsPage() {
  const supabase = createClient();
  const { data: reports } = await supabase
    .from('treatment_reports')
    .select('*, member:members(id, full_name), staff:staff(display_name), store:stores(name)')
    .order('treatment_date', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="施術レポート"
        description="施術ごとの肌・顔のスコアと写真を記録、変化を可視化します"
        actions={
          <Link href="/treatments/new">
            <Button size="sm">
              <Plus size={14} />
              新規入力
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-0">
          {(reports ?? []).length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={28} />}
              title="まだ施術レポートがありません"
              description="施術後にお客様の状態を記録すると、来店ごとの変化が比較できます"
              action={
                <Link href="/treatments/new">
                  <Button size="sm">最初のレポートを入力</Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>会員</th>
                    <th>メニュー</th>
                    <th>担当</th>
                    <th>店舗</th>
                    <th className="text-right">肌</th>
                    <th className="text-right">顔</th>
                    <th className="text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports ?? []).map((r: any) => {
                    const skin = avgScore(SKIN_AXES, r.skin_scores ?? {});
                    const face = avgScore(FACE_AXES, r.face_scores ?? {});
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(r.treatment_date)}</td>
                        <td>
                          <Link
                            href={`/treatments/${r.id}`}
                            className="font-medium text-ink-900 hover:text-vivie-600"
                          >
                            {r.member?.full_name ?? '—'}
                          </Link>
                        </td>
                        <td className="text-ink-600">{r.menu ?? '—'}</td>
                        <td className="text-xs text-ink-500">{r.staff?.display_name ?? '—'}</td>
                        <td className="text-xs text-ink-500">{r.store?.name ?? '—'}</td>
                        <td className="text-right">
                          {skin > 0 ? <Badge tone="rose">{skin}/5</Badge> : '—'}
                        </td>
                        <td className="text-right">
                          {face > 0 ? <Badge tone="amber">{face}/5</Badge> : '—'}
                        </td>
                        <td className="text-right text-sm">{r.amount ? formatYen(r.amount) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
