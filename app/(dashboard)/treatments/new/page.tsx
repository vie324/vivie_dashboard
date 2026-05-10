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

  // 既存会員 + カウンセリング済みかつ未紐付けのお客様を取得
  const [{ data: members }, { data: stores }, { data: counselings }] = await Promise.all([
    supabase
      .from('members')
      .select('id, full_name, furigana, line_picture_url')
      .order('full_name')
      .limit(2000),
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    // 過去 90 日のカウンセリング (新規来店候補)
    supabase
      .from('counseling_records')
      .select('id, full_name, furigana, phone, birth_date, address, occupation, member_id, submitted_at, store_id')
      .gte('submitted_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('submitted_at', { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader
        title="施術レポートを入力"
        description="新規来店 (カウンセリング済) または既存会員から選択してください"
      />
      <TreatmentForm
        members={(members ?? []) as any}
        stores={(stores ?? []) as any}
        counselings={(counselings ?? []) as any}
        staffId={staff.id}
        defaultStoreId={staff.primary_store_id}
      />
    </div>
  );
}
