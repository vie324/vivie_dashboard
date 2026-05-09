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
  const { data: members } = await supabase
    .from('members')
    .select('*, primary_store:stores(name), subscriptions:member_subscriptions(plan_id, status, plan:subscription_plans(name))')
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="会員管理"
        description="Square 連携会員と手動登録会員を統合管理します"
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
      <MembersTable members={(members as any) ?? []} />
    </div>
  );
}
