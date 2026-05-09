import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  VISIT_REASONS,
  PAST_TREATMENTS,
  SWITCH_REASONS,
  PAST_COMPLAINTS,
  SKIN_CONCERNS,
  FACE_CONCERNS,
  BODY_CONCERNS,
  GOAL_TIMELINES,
  MONTHLY_BUDGETS,
  labelOf,
  labelsOf,
} from '@/lib/counseling-options';
import { formatDate, formatDateTime } from '@/lib/utils';
import { CounselingReviewActions } from '@/components/counseling/review-actions';

export default async function CounselingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: record } = await supabase
    .from('counseling_records')
    .select('*, store:stores(name), member:members(id, full_name)')
    .eq('id', params.id)
    .maybeSingle();
  if (!record) notFound();

  const r = record as any;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-4xl">
      <PageHeader
        title={r.full_name}
        description={`${r.store?.name ?? '—'} ・ 提出日 ${formatDateTime(r.submitted_at)}`}
        actions={<CounselingReviewActions id={r.id} reviewed={!!r.reviewed_at} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="フリガナ" value={r.furigana ?? '—'} />
            <Info label="電話番号" value={r.phone} />
            <Info label="生年月日" value={formatDate(r.birth_date)} />
            <Info label="ご職業" value={r.occupation ?? '—'} />
            <Info label="ご住所" value={r.address ?? '—'} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>来店動機・経験</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Section label="来店動機" values={labelsOf(VISIT_REASONS, r.visit_reasons)} extra={r.visit_reason_other} />
            <Section label="過去の施術" values={labelsOf(PAST_TREATMENTS, r.past_treatments)} />
            <SingleSection label="乗り換え理由" value={labelOf(SWITCH_REASONS, r.switch_reason)} extra={r.switch_reason_other} />
            <Section label="前サロンの不満" values={labelsOf(PAST_COMPLAINTS, r.past_complaints)} extra={r.past_complaints_other} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>お悩み</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Section label="お肌" values={labelsOf(SKIN_CONCERNS, r.skin_concerns)} />
          <Section label="お顔" values={labelsOf(FACE_CONCERNS, r.face_concerns)} />
          <Section label="お身体" values={labelsOf(BODY_CONCERNS, r.body_concerns)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>目標と予算</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info label="目標までの期間" value={labelOf(GOAL_TIMELINES, r.goal_timeline)} />
          <Info label="毎月の美容予算" value={labelOf(MONTHLY_BUDGETS, r.monthly_budget)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-ink-500 shrink-0">{label}</span>
      <span className="text-sm text-ink-900 text-right">{value}</span>
    </div>
  );
}

function Section({ label, values, extra }: { label: string; values: string[]; extra?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-500 mb-1.5">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-ink-300">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} tone="rose">
              {v}
            </Badge>
          ))}
        </div>
      )}
      {extra && <p className="mt-2 text-xs text-ink-500">補足: {extra}</p>}
    </div>
  );
}

function SingleSection({ label, value, extra }: { label: string; value: string; extra?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-500 mb-1.5">{label}</p>
      <Badge tone="default">{value}</Badge>
      {extra && <p className="mt-2 text-xs text-ink-500">補足: {extra}</p>}
    </div>
  );
}
