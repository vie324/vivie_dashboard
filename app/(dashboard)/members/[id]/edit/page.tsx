import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { MemberForm } from '@/components/members/member-form';

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: member }, { data: stores }] = await Promise.all([
    supabase.from('members').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('stores').select('id, name').eq('is_active', true),
  ]);
  if (!member) notFound();

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader title="会員情報を編集" description={member.full_name} />
      <MemberForm stores={stores ?? []} initial={member as any} />
    </div>
  );
}
