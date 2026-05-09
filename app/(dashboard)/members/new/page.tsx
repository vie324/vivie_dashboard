import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { MemberForm } from '@/components/members/member-form';

export default async function NewMemberPage() {
  const supabase = createClient();
  const { data: stores } = await supabase.from('stores').select('id, name').eq('is_active', true);
  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader title="会員を新規登録" description="手動で会員情報を登録します" />
      <MemberForm stores={stores ?? []} />
    </div>
  );
}
