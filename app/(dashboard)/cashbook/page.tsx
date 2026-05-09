import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { CashbookView } from '@/components/cashbook/cashbook-view';
import { todayISO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CashbookPage({
  searchParams,
}: {
  searchParams: { month?: string; store?: string };
}) {
  const supabase = createClient();
  const month = searchParams.month ?? todayISO().slice(0, 7);
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  const [{ data: stores }, { data: entries }] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('cashbook_entries')
      .select('*, recorded_by_staff:staff!cashbook_entries_recorded_by_fkey(display_name)')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false })
      .limit(1000),
  ]);

  const storeList = (stores ?? []) as { id: string; name: string }[];
  const storeId = searchParams.store ?? storeList[0]?.id ?? '';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="出納帳"
        description="店舗ごとの収支を管理。Square 連携の入金は自動で記録されます"
      />
      <CashbookView
        stores={storeList}
        initialEntries={(entries ?? []) as any}
        initialMonth={month}
        initialStoreId={storeId}
      />
    </div>
  );
}
