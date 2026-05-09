import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TreatmentDetailView } from '@/components/treatments/treatment-detail-view';
import { LineFollowupPanel } from '@/components/treatments/line-followup-panel';
import { ChevronLeft } from 'lucide-react';
import { formatDate, formatYen } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TreatmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: report } = await supabase
    .from('treatment_reports')
    .select(
      '*, member:members(id, full_name, furigana, line_user_id, line_display_name), staff:staff(display_name), store:stores(name)',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!report) notFound();
  const r = report as any;

  // 同じ会員の過去レポート (このレポートより前のもの)
  const { data: previousList } = await supabase
    .from('treatment_reports')
    .select('id, treatment_date, skin_scores, face_scores, body_scores')
    .eq('member_id', r.member_id)
    .lt('treatment_date', r.treatment_date)
    .order('treatment_date', { ascending: false })
    .limit(1);
  const previous = (previousList ?? [])[0] ?? null;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <PageHeader
        title={r.member?.full_name ?? '—'}
        description={`${formatDate(r.treatment_date)} ・ ${r.store?.name ?? ''} ・ 担当 ${r.staff?.display_name ?? '—'}`}
        actions={
          <Link href="/treatments">
            <Button variant="ghost" size="sm">
              <ChevronLeft size={14} />
              一覧に戻る
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>施術内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="メニュー" value={r.menu ?? '—'} />
            <Info label="所要時間" value={r.duration_minutes ? `${r.duration_minutes} 分` : '—'} />
            <Info label="金額" value={r.amount ? formatYen(r.amount) : '—'} />
            {previous && (
              <div className="mt-3 rounded-lg bg-vivie-50/60 px-3 py-2">
                <p className="text-xs text-vivie-700">
                  前回比較: {formatDate(previous.treatment_date)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>所感</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-500 mb-1">施術後の所感</p>
              <p className="whitespace-pre-wrap text-ink-700">{r.observations ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 mb-1">次回への提案</p>
              <p className="whitespace-pre-wrap text-ink-700">{r.next_recommendation ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <LineFollowupPanel
        reportId={r.id}
        isFirstVisit={r.is_first_visit}
        contracted={r.contracted}
        followupOffer={r.followup_offer}
        lineSentAt={r.line_sent_at}
        lineSendError={r.line_send_error}
        memberName={r.member?.full_name ?? ''}
        memberId={r.member?.id ?? ''}
        memberLineUserId={r.member?.line_user_id ?? null}
        memberLineDisplayName={r.member?.line_display_name ?? null}
      />

      <TreatmentDetailView
        report={r}
        previous={previous as any}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}
