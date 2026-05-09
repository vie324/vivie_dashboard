import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { LineLinkPanel } from '@/components/members/line-link-panel';
import { TagPicker } from '@/components/members/tag-picker';
import { MemberTimeline } from '@/components/members/timeline';
import { ScoreHistoryChart } from '@/components/members/score-history-chart';
import { Pencil, Activity } from 'lucide-react';
import { formatDate, formatYen } from '@/lib/utils';
import type { MemberStatus } from '@/types/database';

const statusTone: Record<MemberStatus, 'green' | 'amber' | 'red' | 'blue'> = {
  active: 'green',
  paused: 'amber',
  cancelled: 'red',
  lead: 'blue',
};
const statusLabel: Record<MemberStatus, string> = {
  active: '在籍',
  paused: '休会',
  cancelled: '退会',
  lead: '見込',
};

export const dynamic = 'force-dynamic';

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: member } = await supabase
    .from('members')
    .select('*, primary_store:stores(name)')
    .eq('id', params.id)
    .maybeSingle();
  if (!member) notFound();

  const [
    { data: subs },
    { data: visits },
    { data: counseling },
    { data: treatments },
    { data: tags },
    { data: stats },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from('member_subscriptions')
      .select('*, plan:subscription_plans(name, monthly_price)')
      .eq('member_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('visits')
      .select('id, visit_date, menu, amount, is_first_visit')
      .eq('member_id', params.id)
      .order('visit_date', { ascending: false })
      .limit(50),
    supabase
      .from('counseling_records')
      .select('id, submitted_at, skin_concerns, face_concerns, body_concerns')
      .eq('member_id', params.id)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('treatment_reports')
      .select('id, treatment_date, menu, amount, skin_scores, face_scores, body_scores, line_sent_at')
      .eq('member_id', params.id)
      .order('treatment_date', { ascending: false })
      .limit(50),
    supabase
      .from('member_tags')
      .select('tag_id')
      .eq('member_id', params.id),
    supabase.from('member_stats').select('*').eq('member_id', params.id).maybeSingle(),
    supabase
      .from('line_messages')
      .select('id, sent_at, direction, message_text')
      .eq('member_id', params.id)
      .order('sent_at', { ascending: false })
      .limit(20),
  ]);

  const tagIds = (tags ?? []).map((t: any) => t.tag_id);
  const m: any = member;
  const s: any = stats ?? {};

  // タイムラインイベントを統合
  const timelineEvents: any[] = [];
  (visits ?? []).forEach((v: any) =>
    timelineEvents.push({
      type: 'visit',
      date: v.visit_date,
      title: v.is_first_visit ? '初回来店' : '来店',
      meta: v.menu,
      amount: v.amount,
    }),
  );
  (treatments ?? []).forEach((t: any) =>
    timelineEvents.push({
      type: 'treatment',
      date: t.treatment_date,
      title: '施術レポート',
      meta: t.menu,
      amount: t.amount,
      href: `/treatments/${t.id}`,
    }),
  );
  (counseling ?? []).forEach((c: any) =>
    timelineEvents.push({
      type: 'counseling',
      date: c.submitted_at,
      title: 'カウンセリング',
      meta: [...(c.skin_concerns ?? []), ...(c.face_concerns ?? [])].slice(0, 3).join('、'),
      href: `/counseling/${c.id}`,
    }),
  );
  (subs ?? []).forEach((sub: any) =>
    timelineEvents.push({
      type: 'subscription',
      date: sub.started_at ?? sub.created_at,
      title: `サブスク: ${sub.plan?.name ?? '不明なプラン'}`,
      meta: `${sub.status} ・ ${formatYen(sub.plan?.monthly_price ?? 0)}/月`,
    }),
  );
  (messages ?? []).slice(0, 10).forEach((msg: any) =>
    timelineEvents.push({
      type: 'message',
      date: msg.sent_at,
      title: msg.direction === 'inbound' ? 'LINE 受信' : 'LINE 送信',
      meta: (msg.message_text ?? '').slice(0, 50),
    }),
  );
  timelineEvents.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <PageHeader
        title={member.full_name}
        description={member.furigana ?? undefined}
        actions={
          <Link href={`/members/${member.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil size={14} />
              編集
            </Button>
          </Link>
        }
      />

      {/* ヘッダーカード: アバター + 基本情報 + 統計 */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <Avatar
            name={member.full_name}
            src={(member as any).line_picture_url}
            size="lg"
            className="shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[member.status as MemberStatus]}>
                {statusLabel[member.status as MemberStatus]}
              </Badge>
              <Badge tone="default">{member.source === 'square' ? 'Square 連携' : '手動登録'}</Badge>
              {(member as any).primary_store?.name && (
                <Badge tone="rose">{(member as any).primary_store.name}</Badge>
              )}
            </div>
            <TagPicker memberId={member.id} initialTagIds={tagIds} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="来店回数" value={`${s.total_visits ?? 0} 回`} />
              <Stat label="累計売上 (LTV)" value={formatYen(s.total_spend ?? 0)} />
              <Stat
                label="最終来店"
                value={s.last_visit_date ? formatDate(s.last_visit_date) : '—'}
              />
              <Stat label="アクティブ契約" value={`${s.active_subscriptions ?? 0} 件`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>連絡先</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="電話" value={member.phone ?? '—'} />
            <Info label="メール" value={member.email ?? '—'} />
            <Info label="生年月日" value={formatDate(member.birth_date)} />
            <Info label="職業" value={member.occupation ?? '—'} />
            <Info label="住所" value={member.address ?? '—'} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>サブスク</CardTitle>
          </CardHeader>
          <CardContent>
            {(subs ?? []).length === 0 ? (
              <p className="text-sm text-ink-400">サブスク登録はありません</p>
            ) : (
              <div className="space-y-2">
                {(subs ?? []).map((sub: any) => (
                  <div key={sub.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{sub.plan?.name ?? '不明なプラン'}</p>
                      <Badge tone={sub.status === 'ACTIVE' || sub.status === 'active' ? 'green' : 'default'}>
                        {sub.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      開始 {formatDate(sub.started_at)} / 次回 {formatDate(sub.next_billing_at)} ・{' '}
                      {formatYen(sub.plan?.monthly_price ?? 0)}/月
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* スコア推移 */}
      {(treatments ?? []).length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>スコアの推移</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreHistoryChart treatments={(treatments ?? []) as any} />
          </CardContent>
        </Card>
      )}

      {/* タイムライン */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>タイムライン</CardTitle>
          <Link href={`/treatments/new?member=${member.id}`}>
            <Button variant="secondary" size="sm">
              <Activity size={14} />
              施術レポート入力
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <MemberTimeline events={timelineEvents} />
        </CardContent>
      </Card>

      <LineLinkPanel
        memberId={member.id}
        memberName={member.full_name}
        currentLineUserId={(member as any).line_user_id ?? null}
        currentLineDisplayName={(member as any).line_display_name ?? null}
      />

      {member.notes && (
        <Card>
          <CardHeader>
            <CardTitle>メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-ink-700">{member.notes}</p>
          </CardContent>
        </Card>
      )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50/50 border border-ink-100 px-3 py-2">
      <p className="text-[10px] text-ink-500">{label}</p>
      <p className="font-serif text-base font-semibold text-ink-900 mt-0.5">{value}</p>
    </div>
  );
}
