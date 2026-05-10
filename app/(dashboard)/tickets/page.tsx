import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { TicketsView } from '@/components/tickets/tickets-view';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  const supabase = createClient();

  const [{ data: tickets }, { data: plans }] = await Promise.all([
    supabase
      .from('ticket_overview')
      .select('*')
      .order('expires_at', { ascending: true })
      .limit(2000),
    supabase
      .from('ticket_plans')
      .select('*')
      .order('display_order')
      .order('total_count'),
  ]);

  const isManager = staff.role === 'admin' || staff.role === 'manager';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="回数券管理"
        description="発行された回数券の残数・期限を一覧管理"
        actions={
          isManager && (
            <Link href="/tickets/plans">
              <Button size="sm" variant="secondary">
                <Settings size={14} />
                プラン管理
              </Button>
            </Link>
          )
        }
      />
      <TicketsView tickets={(tickets ?? []) as any} plans={(plans ?? []) as any} />
    </div>
  );
}
