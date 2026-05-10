import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { ReservationsView } from '@/components/reservations/reservations-view';
import { TimelineBoard } from '@/components/reservations/timeline-board';
import { Plus, Upload } from 'lucide-react';
import { todayISO, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type View = 'board' | 'list';

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: { date?: string; range?: string; store?: string; view?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  const supabase = createClient();

  const view: View = searchParams.view === 'list' ? 'list' : 'board';
  const center = searchParams.date ?? todayISO();
  const range = (searchParams.range ?? 'week') as 'day' | 'week' | 'month';

  let fromIso: string;
  let toIso: string;
  if (view === 'board') {
    const start = new Date(`${center}T00:00:00`);
    const end = new Date(`${center}T23:59:59`);
    fromIso = start.toISOString();
    toIso = end.toISOString();
  } else {
    const center0 = new Date(center);
    const from = new Date(center0);
    let to = new Date(center0);
    if (range === 'day') {
      to.setDate(to.getDate() + 1);
    } else if (range === 'week') {
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() + 7);
    } else {
      from.setDate(1);
      to = new Date(center0.getFullYear(), center0.getMonth() + 1, 0);
    }
    fromIso = from.toISOString();
    toIso = to.toISOString();
  }

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

  const baseQuery: Record<string, string> = {};
  if (searchParams.date) baseQuery.date = searchParams.date;
  if (searchParams.store) baseQuery.store = searchParams.store;
  if (searchParams.range) baseQuery.range = searchParams.range;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="予約管理"
        description="HPB / minimo / 電話 / SNS 等からの予約を一元管理"
        actions={
          <>
            <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
              <Link
                href={{ pathname: '/reservations', query: { ...baseQuery, view: 'board' } }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'board' ? 'bg-vivie-100 text-vivie-700' : 'text-ink-500 hover:bg-ink-50',
                )}
              >
                予約台帳
              </Link>
              <Link
                href={{ pathname: '/reservations', query: { ...baseQuery, view: 'list' } }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-vivie-100 text-vivie-700' : 'text-ink-500 hover:bg-ink-50',
                )}
              >
                一覧
              </Link>
            </div>
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
      {view === 'board' ? (
        <TimelineBoard
          date={center}
          reservations={(reservations ?? []) as any}
          stores={(stores ?? []) as any}
          staff={(staffList ?? []) as any}
        />
      ) : (
        <ReservationsView
          center={center}
          range={range}
          reservations={(reservations ?? []) as any}
          stores={(stores ?? []) as any}
          staff={(staffList ?? []) as any}
        />
      )}
    </div>
  );
}
