import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryView } from '@/components/inventory/inventory-view';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  const supabase = createClient();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');

  const isManager = staff.role === 'admin' || staff.role === 'manager';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="在庫管理" description="物販・消耗品の在庫と入出庫を管理します" />
      <InventoryView initialProducts={(products ?? []) as any} canManage={isManager} />
    </div>
  );
}
