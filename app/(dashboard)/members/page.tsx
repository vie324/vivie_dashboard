import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { MembersTable } from '@/components/members/members-table';
import { SquareSyncButton } from '@/components/members/sync-button';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const supabase = createClient();
  const [{ data: members }, { data: stats }, { data: tagsByMember }] = await Promise.all([
    supabase
      .from('members')
      .select(
        '*, primary_store:stores(name), subscriptions:member_subscriptions(plan_id, status, plan:subscription_plans(name))',
      )
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('member_stats').select('*'),
    supabase.from('member_tags').select('member_id, tag:tags(id, name, color)'),
  ]);

  // 集計と紐付け
  const statsMap = new Map<string, any>();
  (stats ?? []).forEach((s: any) => statsMap.set(s.member_id, s));
  const tagMap = new Map<string, any[]>();
  (tagsByMember ?? []).forEach((mt: any) => {
    const arr = tagMap.get(mt.member_id) ?? [];
    arr.push({ tag: mt.tag });
    tagMap.set(mt.member_id, arr);
  });

  const enriched = (members ?? []).map((m: any) => ({
    ...m,
    stats: statsMap.get(m.id) ?? null,
    member_tags: tagMap.get(m.id) ?? [],
  }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="会員管理"
        description="Square 連携会員と手動登録会員を統合管理。来店頻度・LTV・タグで絞り込み"
        actions={
          <>
            <SquareSyncButton />
            <Link href="/members/new">
              <Button size="sm">
                <Plus size={14} />
                新規登録
              </Button>
            </Link>
          </>
        }
      />
      <MembersTable members={enriched as any} />
    </div>
  );
}
