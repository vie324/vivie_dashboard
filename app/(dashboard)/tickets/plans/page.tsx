import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { TicketPlansAdmin } from '@/components/tickets/ticket-plans-admin';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TicketPlansPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/tickets');

  const supabase = createClient();
  const { data: plans } = await supabase
    .from('ticket_plans')
    .select('*')
    .order('display_order')
    .order('total_count');

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        回数券一覧に戻る
      </Link>
      <PageHeader title="回数券プラン管理" description="プラン (回数 / 価格 / 有効期間) を管理します" />
      <TicketPlansAdmin plans={(plans ?? []) as any} />
    </div>
  );
}
