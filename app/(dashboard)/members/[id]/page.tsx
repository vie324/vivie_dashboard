import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
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

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: member } = await supabase
    .from('members')
    .select('*, primary_store:stores(name)')
    .eq('id', params.id)
    .maybeSingle();
  if (!member) notFound();

  const [{ data: subs }, { data: visits }, { data: counseling }] = await Promise.all([
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
      .limit(20),
    supabase
      .from('counseling_records')
      .select('id, submitted_at, skin_concerns, face_concerns, body_concerns')
      .eq('member_id', params.id)
      .order('submitted_at', { ascending: false }),
  ]);

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="ステータス" value={<Badge tone={statusTone[member.status as MemberStatus]}>{statusLabel[member.status as MemberStatus]}</Badge>} />
            <Info label="ソース" value={member.source === 'square' ? 'Square 連携' : '手動登録'} />
            <Info label="店舗" value={(member as any).primary_store?.name ?? '—'} />
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
                {(subs ?? []).map((s: any) => (
                  <div key={s.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{s.plan?.name ?? '不明なプラン'}</p>
                      <Badge tone={s.status === 'ACTIVE' || s.status === 'active' ? 'green' : 'default'}>
                        {s.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      開始 {formatDate(s.started_at)} / 次回 {formatDate(s.next_billing_at)} ・{' '}
                      {formatYen(s.plan?.monthly_price ?? 0)}/月
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>来店履歴</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(visits ?? []).length === 0 ? (
              <p className="p-5 text-sm text-ink-400">来店記録はまだありません</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>メニュー</th>
                    <th className="text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {(visits ?? []).map((v: any) => (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap">
                        {formatDate(v.visit_date)}
                        {v.is_first_visit && <Badge tone="rose" className="ml-2">初回</Badge>}
                      </td>
                      <td className="text-ink-600">{v.menu ?? '—'}</td>
                      <td className="text-right">{formatYen(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>カウンセリング履歴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(counseling ?? []).length === 0 ? (
              <p className="text-sm text-ink-400">カウンセリング記録はありません</p>
            ) : (
              (counseling ?? []).map((c: any) => (
                <Link
                  key={c.id}
                  href={`/counseling/${c.id}`}
                  className="block rounded-xl border border-ink-100 p-3 hover:bg-vivie-50/40"
                >
                  <p className="text-xs text-ink-500">{formatDate(c.submitted_at)}</p>
                  <p className="mt-1 text-sm">
                    肌: {c.skin_concerns?.join('、') || '—'} / 顔: {c.face_concerns?.join('、') || '—'}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-sm text-ink-900">{value}</span>
    </div>
  );
}
