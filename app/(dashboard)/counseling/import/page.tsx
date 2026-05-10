import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { CounselingImportForm } from '@/components/counseling/import-form';

export const dynamic = 'force-dynamic';

export default async function CounselingImportPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  if (staff.role !== 'admin' && staff.role !== 'manager') redirect('/counseling');

  const supabase = createClient();
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <PageHeader
        title="カウンセリング 一括インポート"
        description="スプレッドシートのデータをタブ区切りでまとめて取り込みます (重複は自動スキップ)"
      />
      <CounselingImportForm stores={(stores ?? []) as any} />
    </div>
  );
}
