'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { LogoIcon } from '@/components/ui/logo';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm animate-scale-in rounded-3xl border border-ink-100 bg-white/90 p-8 shadow-glow backdrop-blur"
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoIcon size="lg" asImage className="mb-3" />
        <h1
          className="font-serif text-3xl text-vivie-500"
          style={{ letterSpacing: '0.16em' }}
        >
          vivie
        </h1>
        <span className="gold-rule mx-auto mt-2 !w-16 bg-gradient-to-r from-transparent via-gold-400 to-transparent" aria-hidden />
        <p className="mt-3 text-sm text-ink-500">スタッフアカウントでログイン</p>
      </div>

      <div className="space-y-4">
        <Field label="メールアドレス" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="パスワード" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <Button type="submit" className="mt-6 w-full" size="lg" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
        ログイン
      </Button>

      <p className="mt-4 text-center text-xs text-ink-400">
        パスワードを忘れた場合は管理者にお問い合わせください
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-vivie-100 via-vivie-50 to-white px-4">
      {/* 柔らかな装飾光 */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-vivie-200/50 blur-3xl"
        aria-hidden
      />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
