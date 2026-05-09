import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { TreatmentForm } from '@/components/treatments/treatment-form';

export const dynamic = 'force-dynamic';

export default async function NewTreatmentPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  const supabase = createClient();

  const [{ data: members }, { data: stores }] = await Promise.all([
    supabase.from('members').select('id, full_name, furigana').order('full_name').limit(2000),
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader title="施術レポートを入力" description="本日の施術内容と肌・顔の状態を記録します" />
      <TreatmentForm
        members={(members ?? []) as any}
        stores={(stores ?? []) as any}
        staffId={staff.id}
        defaultStoreId={staff.primary_store_id}
      />
    </div>
  );
}
