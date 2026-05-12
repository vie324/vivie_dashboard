import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';
import { SquareSyncButton } from '@/components/members/sync-button';
import { formatDate, formatYen } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role === 'store') redirect('/');
  const supabase = createClient();

  const [{ data: subs }, { data: plans }] = await Promise.all([
    supabase
      .from('member_subscriptions')
      .select('*, member:members(id, full_name, phone), plan:subscription_plans(name, monthly_price)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('subscription_plans').select('*').eq('is_active', true).order('monthly_price'),
  ]);

  const activeCount = (subs ?? []).filter((s: any) =>
    ['ACTIVE', 'active'].includes(s.status),
  ).length;
  const totalMRR = (subs ?? [])
    .filter((s: any) => ['ACTIVE', 'active'].includes(s.status))
    .reduce((sum: number, s: any) => sum + (s.plan?.monthly_price ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="サブスク管理"
        description="Square から自動同期されるサブスクリプションを表示します"
        actions={<SquareSyncButton />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="アクティブ契約" value={`${activeCount} 件`} />
        <StatCard label="月次定額売上 (MRR)" value={formatYen(totalMRR)} />
        <StatCard label="プラン数" value={`${(plans ?? []).length} 種類`} />
      </div>

      <Card>
        <CardContent className="p-0">
          {(subs ?? []).length === 0 ? (
            <EmptyState
              icon={<CreditCard size={28} />}
              title="サブスク契約がまだ取り込まれていません"
              description="右上の「Square 同期」をクリックして取り込んでください"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>会員</th>
                    <th>プラン</th>
                    <th>金額</th>
                    <th>ステータス</th>
                    <th>開始</th>
                    <th>次回課金</th>
                  </tr>
                </thead>
                <tbody>
                  {(subs ?? []).map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        {s.member ? (
                          <Link
                            href={`/members/${s.member.id}`}
                            className="text-ink-900 hover:text-vivie-600 font-medium"
                          >
                            {s.member.full_name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{s.plan?.name ?? '—'}</td>
                      <td>{formatYen(s.plan?.monthly_price ?? 0)}</td>
                      <td>
                        <Badge tone={['ACTIVE', 'active'].includes(s.status) ? 'green' : 'default'}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="text-xs text-ink-500">{formatDate(s.started_at)}</td>
                      <td className="text-xs text-ink-500">{formatDate(s.next_billing_at)}</td>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}
