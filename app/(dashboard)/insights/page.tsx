import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Crown,
  HeartHandshake,
  Sparkles,
  AlertTriangle,
  MoonStar,
  MessageCircle,
  Cake,
  Ghost,
  Gem,
} from 'lucide-react';
import { formatYen, formatDate, todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// 顧客インサイト: 売上を伸ばすためのアクション起点。
//  - RFM セグメント (最終来店 Recency / 来店頻度 Frequency / 累計利用額 Monetary)
//  - LTV ランキング / 離脱リスク / サブスク幽霊会員 / 誕生月リスト
// 各リストから LINE メッセージへ直接飛べる。

type MemberRow = {
  id: string;
  full_name: string;
  status: string;
  birth_date: string | null;
  line_user_id: string | null;
  line_picture_url: string | null;
};

type StatsRow = {
  member_id: string;
  total_visits: number | null;
  last_visit_date: string | null;
  total_spend: number | null;
  active_subscriptions: number | null;
};

type Insight = MemberRow & {
  visits: number;
  lastVisit: string | null;
  spend: number;
  activeSubs: number;
  daysSince: number | null;
  segment: SegmentKey;
};

type SegmentKey = 'vip' | 'regular' | 'new' | 'at_risk' | 'dormant' | 'no_visit';

const SEGMENTS: Record<
  SegmentKey,
  { label: string; description: string; icon: typeof Crown; tone: string }
> = {
  vip: {
    label: 'VIP',
    description: '来店10回以上 または 累計 ¥200,000 以上',
    icon: Crown,
    tone: 'bg-amber-50 text-amber-700',
  },
  regular: {
    label: '常連',
    description: '来店3回以上・60日以内に来店',
    icon: HeartHandshake,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  new: {
    label: '新規',
    description: '来店1〜2回・90日以内に来店',
    icon: Sparkles,
    tone: 'bg-sky-50 text-sky-700',
  },
  at_risk: {
    label: '離脱リスク',
    description: '最終来店から45〜90日',
    icon: AlertTriangle,
    tone: 'bg-orange-50 text-orange-700',
  },
  dormant: {
    label: '休眠',
    description: '最終来店から90日超',
    icon: MoonStar,
    tone: 'bg-violet-50 text-violet-700',
  },
  no_visit: {
    label: '未来店',
    description: '来店記録なし',
    icon: Ghost,
    tone: 'bg-ink-100 text-ink-600',
  },
};

function classify(m: Insight): SegmentKey {
  if (m.visits === 0) return 'no_visit';
  if (m.visits >= 10 || m.spend >= 200000) {
    // VIP でも離脱していたらリスク側で扱う
    if (m.daysSince != null && m.daysSince > 90) return 'dormant';
    if (m.daysSince != null && m.daysSince > 45) return 'at_risk';
    return 'vip';
  }
  if (m.daysSince == null) return 'no_visit';
  if (m.daysSince > 90) return 'dormant';
  if (m.daysSince > 45) return 'at_risk';
  if (m.visits >= 3) return 'regular';
  return 'new';
}

export default async function InsightsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/');

  const supabase = createClient();
  const today = todayISO();
  const thisMonth = Number(today.slice(5, 7));

  const [{ data: members }, { data: stats }] = await Promise.all([
    supabase
      .from('members')
      .select('id, full_name, status, birth_date, line_user_id, line_picture_url')
      .limit(5000),
    supabase
      .from('member_stats')
      .select('member_id, total_visits, last_visit_date, total_spend, active_subscriptions')
      .limit(5000),
  ]);

  const statsById = new Map<string, StatsRow>(
    ((stats ?? []) as StatsRow[]).map((s) => [s.member_id, s]),
  );
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();

  const insights: Insight[] = ((members ?? []) as MemberRow[])
    .filter((m) => m.status !== 'cancelled')
    .map((m) => {
      const s = statsById.get(m.id);
      const lastVisit = s?.last_visit_date ?? null;
      const daysSince = lastVisit
        ? Math.floor((todayMs - new Date(`${lastVisit}T00:00:00Z`).getTime()) / 86400000)
        : null;
      const base = {
        ...m,
        visits: s?.total_visits ?? 0,
        lastVisit,
        spend: s?.total_spend ?? 0,
        activeSubs: s?.active_subscriptions ?? 0,
        daysSince,
        segment: 'no_visit' as SegmentKey,
      };
      base.segment = classify(base);
      return base;
    });

  const bySegment = (key: SegmentKey) => insights.filter((m) => m.segment === key);
  const totalClassified = insights.length;

  // LTV ランキング (累計利用額)
  const ltvTop = [...insights].sort((a, b) => b.spend - a.spend).slice(0, 10);

  // 離脱リスク (来店実績のある順にフォローすべき人から)
  const atRisk = bySegment('at_risk').sort((a, b) => b.spend - a.spend);

  // サブスク幽霊会員: 課金は続いているのに 30 日以上来店なし → 解約予備軍
  const ghostSubscribers = insights
    .filter((m) => m.activeSubs > 0 && (m.daysSince == null || m.daysSince > 30))
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));

  // 今月の誕生日
  const birthdays = insights
    .filter((m) => m.birth_date && Number(m.birth_date.slice(5, 7)) === thisMonth)
    .sort((a, b) => (a.birth_date ?? '').slice(8).localeCompare((b.birth_date ?? '').slice(8)));

  return (
    <div className="space-y-6 stagger-children">
      <PageHeader
        title="顧客インサイト"
        description="来店履歴と決済データから、今アプローチすべきお客様を洗い出します"
      />

      {/* セグメント概況 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(SEGMENTS) as SegmentKey[]).map((key) => {
          const seg = SEGMENTS[key];
          const count = bySegment(key).length;
          const pct = totalClassified > 0 ? Math.round((count / totalClassified) * 100) : 0;
          const Icon = seg.icon;
          return (
            <div key={key} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${seg.tone}`}
                >
                  <Icon size={16} />
                </span>
                <span className="text-xs text-ink-400">{pct}%</span>
              </div>
              <p className="mt-2 font-serif text-xl font-semibold text-ink-900">{count}名</p>
              <p className="text-xs font-medium text-ink-700">{seg.label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-ink-400">{seg.description}</p>
            </div>
          );
        })}
      </div>

      {/* サブスク幽霊会員 — 最優先アクション */}
      {ghostSubscribers.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Ghost className="text-orange-600" size={18} />
              サブスク継続中なのに来店が途絶えているお客様 ({ghostSubscribers.length}名)
            </CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              解約の最有力予備軍です。予約のご案内 LINE を送って来店につなげましょう。
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-ink-100">
              {ghostSubscribers.slice(0, 8).map((m) => (
                <MemberActionRow
                  key={m.id}
                  m={m}
                  meta={
                    m.daysSince != null
                      ? `最終来店 ${formatDate(m.lastVisit)} (${m.daysSince}日前)`
                      : '来店記録なし'
                  }
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 離脱リスク */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={18} />
              離脱リスク ({atRisk.length}名)
            </CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              最終来店から45日以上。今なら一声で戻っていただけます
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {atRisk.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                離脱リスクのお客様はいません 🎉
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {atRisk.slice(0, 8).map((m) => (
                  <MemberActionRow
                    key={m.id}
                    m={m}
                    meta={`最終来店 ${formatDate(m.lastVisit)} ・ 累計 ${formatYen(m.spend)}`}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 誕生月 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="text-vivie-500" size={18} />
              今月お誕生日のお客様 ({birthdays.length}名)
            </CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              バースデー特典のご案内は来店のきっかけ作りに最適です
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {birthdays.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                今月お誕生日のお客様はいません
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {birthdays.slice(0, 8).map((m) => (
                  <MemberActionRow
                    key={m.id}
                    m={m}
                    meta={`${Number(m.birth_date!.slice(5, 7))}月${Number(m.birth_date!.slice(8, 10))}日 ・ ${SEGMENTS[m.segment].label}`}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LTV ランキング */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="text-vivie-500" size={18} />
            累計利用額ランキング (LTV)
          </CardTitle>
          <p className="mt-0.5 text-xs text-ink-500">
            上位のお客様ほど丁寧なフォローを。VIP 特典・紹介のお願いも効果的です
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {ltvTop.filter((m) => m.spend > 0).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">
              施術レポートに金額が入力されると集計されます
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>お客様</th>
                    <th>セグメント</th>
                    <th className="text-right">累計利用額</th>
                    <th className="text-right">来店回数</th>
                    <th>最終来店</th>
                  </tr>
                </thead>
                <tbody>
                  {ltvTop
                    .filter((m) => m.spend > 0)
                    .map((m, i) => (
                      <tr key={m.id}>
                        <td className="font-serif text-ink-400">{i + 1}</td>
                        <td>
                          <Link
                            href={`/members/${m.id}`}
                            className="flex items-center gap-2 font-medium hover:text-vivie-600"
                          >
                            <Avatar name={m.full_name} src={m.line_picture_url} size="sm" />
                            {m.full_name}
                          </Link>
                        </td>
                        <td>
                          <Badge
                            tone={
                              m.segment === 'vip'
                                ? 'amber'
                                : m.segment === 'at_risk' || m.segment === 'dormant'
                                  ? 'red'
                                  : 'green'
                            }
                          >
                            {SEGMENTS[m.segment].label}
                          </Badge>
                        </td>
                        <td className="text-right font-medium">{formatYen(m.spend)}</td>
                        <td className="text-right">{m.visits}回</td>
                        <td className="text-xs text-ink-500">{formatDate(m.lastVisit)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MemberActionRow({ m, meta }: { m: Insight; meta: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Avatar name={m.full_name} src={m.line_picture_url} size="sm" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/members/${m.id}`}
          className="block truncate text-sm font-medium hover:text-vivie-600"
        >
          {m.full_name}
        </Link>
        <p className="truncate text-xs text-ink-500">{meta}</p>
      </div>
      {m.activeSubs > 0 && <Badge tone="rose">サブスク</Badge>}
      {m.line_user_id ? (
        <Link
          href={`/messages/${m.line_user_id}`}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <MessageCircle size={13} />
          LINE
        </Link>
      ) : (
        <span className="shrink-0 text-[10px] text-ink-300">LINE未連携</span>
      )}
    </li>
  );
}
