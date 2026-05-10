import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { ReservationForm } from '@/components/reservations/reservation-form';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  const supabase = createClient();

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!reservation) notFound();

  const [{ data: stores }, { data: staffList }, { data: members }] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase.from('staff').select('id, display_name').eq('is_active', true).order('display_name'),
    supabase.from('members').select('id, full_name, furigana, phone, line_picture_url').order('full_name').limit(2000),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-vivie-600"
      >
        <ChevronLeft size={14} />
        予約一覧に戻る
      </Link>
      <PageHeader title="予約詳細" description="登録内容を編集します" />
      <ReservationForm
        stores={(stores ?? []) as any}
        staff={(staffList ?? []) as any}
        members={(members ?? []) as any}
        defaultStoreId={(reservation as any).store_id}
        initial={reservation as any}
      />
    </div>
  );
}
