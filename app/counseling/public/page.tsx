import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { LogoIcon } from '@/components/ui/logo';
import { ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

// LINE 内蔵ブラウザのキャッシュなどで storeId が脱落して
// /counseling/public/ に直接来ても店舗を選択できるようにする
export default async function PublicCounselingIndexPage() {
  // 匿名アクセス前提なので、RLS をバイパスする service role で取得する
  // (cookie セッションの createClient だと anon ロールで stores が読めず空配列になる)
  const supabase = createServiceClient();
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <main className="min-h-screen bg-gradient-to-br from-vivie-100 via-vivie-50 to-white px-4 py-10">
      <div className="mx-auto max-w-md">
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
          <h1 className="font-serif text-xl font-semibold text-ink-900 mt-4">
            ご来店店舗をお選びください
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            カウンセリングシートをご記入いただきます
          </p>
        </header>

        <div className="space-y-2">
          {(stores ?? []).length === 0 ? (
            <p className="text-center text-sm text-ink-400 py-8">
              現在ご利用いただける店舗がありません
            </p>
          ) : (
            (stores ?? []).map((s: any) => (
              <Link
                key={s.id}
                href={`/counseling/public/${s.id}`}
                className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-4 shadow-sm hover:border-vivie-200 hover:shadow-md transition-all"
              >
                <span className="font-medium text-ink-900">{s.name}</span>
                <ChevronRight size={18} className="text-ink-300" />
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
