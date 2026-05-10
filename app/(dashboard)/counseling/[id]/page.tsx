import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CounselingReviewActions } from '@/components/counseling/review-actions';
import { PostCounselingForm } from '@/components/counseling/post-counseling-form';
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
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Heart,
  User,
  MapPin,
  Phone,
  Cake,
  Briefcase,
  Target,
  Wallet,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CounselingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: record } = await supabase
    .from('counseling_records')
    .select('*, store:stores(name), member:members(id, full_name)')
    .eq('id', params.id)
    .maybeSingle();
  if (!record) notFound();
  const r = record as any;

  // 前後のレコード + スタッフ一覧
  const [{ data: prevList }, { data: nextList }, { data: staffList }] = await Promise.all([
    supabase
      .from('counseling_records')
      .select('id')
      .gt('submitted_at', r.submitted_at)
      .order('submitted_at', { ascending: true })
      .limit(1),
    supabase
      .from('counseling_records')
      .select('id')
      .lt('submitted_at', r.submitted_at)
      .order('submitted_at', { ascending: false })
      .limit(1),
    supabase
      .from('staff')
      .select('id, display_name')
      .eq('is_active', true)
      .order('display_name'),
  ]);
  const prev = (prevList ?? [])[0];
  const next = (nextList ?? [])[0];

  const skin = labelsOf(SKIN_CONCERNS, r.skin_concerns);
  const face = labelsOf(FACE_CONCERNS, r.face_concerns);
  const body = labelsOf(BODY_CONCERNS, r.body_concerns);
  const reasons = labelsOf(VISIT_REASONS, r.visit_reasons);
  const treatments = labelsOf(PAST_TREATMENTS, r.past_treatments);
  const complaints = labelsOf(PAST_COMPLAINTS, r.past_complaints);
  const switchReason = labelOf(SWITCH_REASONS, r.switch_reason);
  const goal = labelOf(GOAL_TIMELINES, r.goal_timeline);
  const budget = labelOf(MONTHLY_BUDGETS, r.monthly_budget);
  const totalConcerns = skin.length + face.length + body.length;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/counseling"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
        >
          <ChevronLeft size={14} />
          一覧に戻る
        </Link>
        <div className="flex items-center gap-2">
          {prev && (
            <Link href={`/counseling/${(prev as any).id}`}>
              <button className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
                <ChevronLeft size={12} />
                前へ
              </button>
            </Link>
          )}
          {next && (
            <Link href={`/counseling/${(next as any).id}`}>
              <button className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
                次へ
                <ChevronRight size={12} />
              </button>
            </Link>
          )}
          <CounselingReviewActions id={r.id} reviewed={!!r.reviewed_at} />
        </div>
      </div>

      {/* ヒーローカード - 名前と要約 */}
      <Card className="border-vivie-200 bg-gradient-to-br from-vivie-50/60 via-white to-white">
        <CardContent className="p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-ink-500 mb-1">{formatDateTime(r.submitted_at)} 提出</p>
              <h1 className="font-serif text-4xl font-semibold text-ink-900">
                {r.full_name}
              </h1>
              {r.furigana && (
                <p className="mt-1 text-base text-ink-500">{r.furigana}</p>
              )}
              <p className="mt-3 text-sm text-ink-600">
                <Sparkles className="inline -mt-1 mr-1 text-vivie-500" size={14} />
                {r.store?.name ?? '—'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-ink-500">悩み件数</p>
              <p className="font-serif text-3xl font-bold text-vivie-600">{totalConcerns}</p>
              <p className="text-xs text-ink-400">項目</p>
            </div>
          </div>

          {/* 目標と予算を大きく */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <HeroPill icon={<Target size={16} />} label="目標までの期間" value={goal} />
            <HeroPill icon={<Wallet size={16} />} label="毎月の美容予算" value={budget} />
          </div>
        </CardContent>
      </Card>

      {/* 施術後の入力 (担当者 / 媒体 / クロージング / 契約コース など) */}
      <PostCounselingForm
        recordId={r.id}
        staff={(staffList ?? []) as any}
        initial={{
          assigned_staff_id: r.assigned_staff_id,
          acquisition_channel: r.acquisition_channel,
          closing_status: r.closing_status,
          closing_status_raw: r.closing_status_raw,
          next_reservation_date: r.next_reservation_date,
          no_contract_reason: r.no_contract_reason,
          contract_reason: r.contract_reason,
          contract_plan: r.contract_plan,
        }}
      />

      {/* 悩み (大きく強調) */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Heart className="text-vivie-500" size={20} />
            <h2 className="font-serif text-xl font-semibold">お悩み</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ConcernPanel title="お肌" tone="rose" items={skin} />
            <ConcernPanel title="お顔" tone="amber" items={face} />
            <ConcernPanel title="お身体" tone="blue" items={body} />
          </div>
        </CardContent>
      </Card>

      {/* 来店経緯 */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="text-vivie-500" size={20} />
            <h2 className="font-serif text-xl font-semibold">来店経緯・他店経験</h2>
          </div>

          <ListSection
            label="当店をお選びいただいた理由"
            items={reasons}
            extra={r.visit_reason_other}
            tone="rose"
          />
          <ListSection
            label="他店で受けたことがある施術"
            items={treatments}
            tone="default"
          />
          <SingleSection
            label="サロンを変えた理由"
            value={switchReason}
            extra={r.switch_reason_other}
          />
          {complaints.length > 0 && (
            <ListSection
              label="前サロンで気になっていた点"
              items={complaints}
              extra={r.past_complaints_other}
              tone="amber"
              icon={<AlertCircle size={14} />}
            />
          )}
        </CardContent>
      </Card>

      {/* 基本情報 (折りたたみ) */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-ink-500" size={18} />
            <h2 className="font-serif text-base font-semibold text-ink-700">お客様情報</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={<Phone size={14} />} label="電話" value={r.phone ?? '—'} />
            <InfoRow icon={<Cake size={14} />} label="生年月日" value={formatDate(r.birth_date)} />
            <InfoRow icon={<Briefcase size={14} />} label="職業" value={r.occupation ?? '—'} />
            <InfoRow icon={<MapPin size={14} />} label="住所" value={r.address ?? '—'} />
          </div>
          {r.internal_notes && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">スタッフ用メモ</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{r.internal_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HeroPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-vivie-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-ink-500 mb-1">
        <span className="text-vivie-500">{icon}</span>
        {label}
      </div>
      <p className="font-serif text-lg font-semibold text-ink-900">
        {value !== '—' ? value : <span className="text-ink-300">未回答</span>}
      </p>
    </div>
  );
}

function ConcernPanel({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'rose' | 'amber' | 'blue';
  items: string[];
}) {
  const headerClass =
    tone === 'rose'
      ? 'bg-vivie-100 text-vivie-700'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-sky-100 text-sky-700';
  const itemClass =
    tone === 'rose'
      ? 'bg-vivie-50 text-vivie-700 border-vivie-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-sky-50 text-sky-700 border-sky-200';

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div
        className={`inline-flex items-center rounded-lg px-3 py-1 text-sm font-bold mb-3 ${headerClass}`}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-300 italic">特になし</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className={`rounded-lg border px-3 py-2 text-base font-medium ${itemClass}`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListSection({
  label,
  items,
  extra,
  tone = 'default',
  icon,
}: {
  label: string;
  items: string[];
  extra?: string | null;
  tone?: 'default' | 'rose' | 'amber';
  icon?: React.ReactNode;
}) {
  const chipTone =
    tone === 'rose'
      ? 'rose' as const
      : tone === 'amber'
        ? 'amber' as const
        : 'default' as const;
  return (
    <div>
      <p className="text-sm font-medium text-ink-700 mb-2 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-300 italic ml-1">該当なし</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} tone={chipTone} className="text-sm py-1 px-3">
              {item}
            </Badge>
          ))}
        </div>
      )}
      {extra && (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs text-ink-600">
          <HelpCircle size={12} className="mt-0.5 shrink-0" />
          {extra}
        </p>
      )}
    </div>
  );
}

function SingleSection({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string | null;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-700 mb-2">{label}</p>
      {value === '—' ? (
        <p className="text-sm text-ink-300 italic ml-1">未回答</p>
      ) : (
        <Badge tone="default" className="text-sm py-1 px-3">
          {value}
        </Badge>
      )}
      {extra && (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs text-ink-600">
          <HelpCircle size={12} className="mt-0.5 shrink-0" />
          {extra}
        </p>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-ink-50/40 px-3 py-2">
      <span className="text-ink-400">{icon}</span>
      <span className="text-xs text-ink-500 w-20 shrink-0">{label}</span>
      <span className="text-ink-900 truncate">{value}</span>
    </div>
  );
}
