import { createServiceClient } from '@/lib/supabase/server';
import { BookingForm } from '@/components/booking/booking-form';
import { LogoIcon } from '@/components/ui/logo';

export const dynamic = 'force-dynamic';

export default async function BookingPage({ params }: { params: { storeId: string } }) {
  const supabase = createServiceClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, is_active')
    .eq('id', params.storeId)
    .maybeSingle();
  const s = store as any;

  if (!s || !s.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50/40 px-6 text-center">
        <p className="text-sm text-ink-500">この予約ページは現在ご利用いただけません。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-vivie-50 via-white to-ink-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoIcon size="md" asImage />
          <h1 className="mt-3 font-serif text-xl text-ink-900">{s.name} ご予約</h1>
          <p className="mt-1 text-sm text-ink-500">ご希望の日時をお選びください</p>
        </div>
        <BookingForm storeId={s.id} storeName={s.name} />
      </div>
    </div>
  );
}
