import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { ReservationsView } from '@/components/reservations/reservations-view';
import { Plus, Upload } from 'lucide-react';
import { todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: { date?: string; range?: string; store?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  const supabase = createClient();

  // デフォルト: 今日 + 前後 7 日
  const center = searchParams.date ?? todayISO();
  const range = searchParams.range ?? 'week'; // day / week / month

  const center0 = new Date(center);
  let from = new Date(center0);
  let to = new Date(center0);
  if (range === 'day') {
    from = new Date(center0);
    to = new Date(center0);
    to.setDate(to.getDate() + 1);
  } else if (range === 'week') {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() + 7);
  } else {
    from.setDate(1);
    to = new Date(center0.getFullYear(), center0.getMonth() + 1, 0);
  }
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [{ data: reservations }, { data: stores }, { data: staffList }] = await Promise.all([
    supabase
      .from('reservation_overview')
      .select('*')
      .gte('reservation_at', fromIso)
      .lte('reservation_at', toIso)
      .order('reservation_at', { ascending: true }),
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase.from('staff').select('id, display_name').eq('is_active', true).order('display_name'),
  ]);

  const isManager = staff.role === 'admin' || staff.role === 'manager';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="予約管理"
        description="HPB / minimo / 電話 / SNS 等からの予約を一元管理"
        actions={
          <>
            {isManager && (
              <Link href="/reservations/import">
                <Button size="sm" variant="secondary">
                  <Upload size={14} />
                  CSV 取込
                </Button>
              </Link>
            )}
            <Link href="/reservations/new">
              <Button size="sm">
                <Plus size={14} />
                新規予約
              </Button>
            </Link>
          </>
        }
      />
      <ReservationsView
        center={center}
        range={range as any}
        reservations={(reservations ?? []) as any}
        stores={(stores ?? []) as any}
        staff={(staffList ?? []) as any}
      />
    </div>
  );
}
