import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { CounselingForm } from '@/components/counseling/counseling-form';
import { ToastProvider } from '@/components/ui/toast';
import { LogoIcon } from '@/components/ui/logo';

export const dynamic = 'force-dynamic';

export default async function PublicCounselingPage({
  params,
}: {
  params: { storeId: string };
}) {
  // 公開フォームは匿名アクセス。stores テーブルの RLS が authenticated のみ
  // SELECT 許可になっているため、cookie セッションの createClient だと
  // ログインしていないお客様は store が null になり notFound() に飛んで
  // 404 ページが出ていた。service role で RLS をバイパスして取得する。
  const supabase = createServiceClient();
  const [{ data: store }, { data: settings }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name')
      .eq('id', params.storeId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('counseling_settings')
      .select('disclaimer')
      .eq('id', 'default')
      .maybeSingle(),
  ]);
  if (!store) notFound();

  return (
    <ToastProvider>
      <main className="min-h-screen bg-gradient-to-br from-vivie-100 via-vivie-50 to-white px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <header className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <LogoIcon size="md" asImage />
              <span
                className="font-serif text-2xl text-vivie-500"
                style={{ letterSpacing: '0.16em' }}
              >
                vivie
              </span>
            </div>
            <h1 className="font-serif text-2xl font-semibold text-ink-900 mt-4">{(store as any).name}</h1>
            <p className="mt-2 text-sm text-ink-500">
              ご来店前にカウンセリングシートをご記入ください
            </p>
          </header>
          <CounselingForm
            storeId={(store as any).id}
            storeName={(store as any).name}
            embed
            disclaimer={(settings as any)?.disclaimer ?? null}
          />
          <footer className="mt-10 text-center text-xs text-ink-400">
            ご記入いただいた情報は施術の参考としてのみ使用いたします
          </footer>
        </div>
      </main>
    </ToastProvider>
  );
}
