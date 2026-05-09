import { redirect } from 'next/navigation';
import { getCurrentStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard/shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未ログイン → ログインへ
  if (!user) redirect('/login');

  const staff = await getCurrentStaff();

  // ログイン済だが staff レコード作成に失敗
  if (!staff) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-vivie-50 via-white to-ink-50 px-4">
        <div className="max-w-md rounded-2xl border border-ink-100 bg-white p-8 shadow-xl">
          <h1 className="font-serif text-xl font-semibold text-ink-900 mb-2">
            アカウントの初期化に失敗しました
          </h1>
          <p className="text-sm text-ink-600 mb-4">
            ログインは成功しましたが、スタッフレコードの作成ができませんでした。
            以下のいずれかを確認してください。
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-600 space-y-1 mb-6">
            <li>
              Vercel の環境変数{' '}
              <code className="bg-ink-100 px-1.5 py-0.5 rounded text-xs">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{' '}
              が正しく設定されているか
            </li>
            <li>
              Supabase で <code className="bg-ink-100 px-1.5 py-0.5 rounded text-xs">staff</code>{' '}
              テーブルが作成されているか (マイグレーション 20260509000001 を実行)
            </li>
            <li>
              ブラウザのコンソール / Vercel のログにエラーが出ていないか
            </li>
          </ul>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-xl bg-vivie-400 hover:bg-vivie-500 text-white py-2.5 text-sm font-medium"
            >
              ログアウトしてやり直す
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <DashboardShell staff={staff}>{children}</DashboardShell>;
}
