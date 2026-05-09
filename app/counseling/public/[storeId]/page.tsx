import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CounselingForm } from '@/components/counseling/counseling-form';
import { ToastProvider } from '@/components/ui/toast';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PublicCounselingPage({
  params,
}: {
  params: { storeId: string };
}) {
  const supabase = createClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', params.storeId)
    .eq('is_active', true)
    .maybeSingle();
  if (!store) notFound();

  return (
    <ToastProvider>
      <main className="min-h-screen bg-gradient-to-br from-vivie-50 via-white to-ink-50 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <header className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-vivie-100 text-vivie-600">
              <Sparkles size={22} />
            </div>
            <h1 className="font-serif text-3xl font-semibold text-ink-900">{store.name}</h1>
            <p className="mt-2 text-sm text-ink-500">
              ご来店前にカウンセリングシートをご記入ください
            </p>
          </header>
          <CounselingForm storeId={store.id} storeName={store.name} embed />
          <footer className="mt-10 text-center text-xs text-ink-400">
            ご記入いただいた情報は施術の参考としてのみ使用いたします
          </footer>
        </div>
      </main>
    </ToastProvider>
  );
}
