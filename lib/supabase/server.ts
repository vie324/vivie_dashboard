import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // RSC でのみ呼ばれた場合は無視 (middleware で更新される)
          }
        },
      },
    },
  );
}

// service role: サーバー側専用。RLS を完全にバイパスする。
// Cookie ベースの SSR クライアントだと user JWT が混入することがあるため、
// 通常の supabase-js クライアントを直接使う。
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// JWT の payload から role を取り出して検証する。
// SUPABASE_SERVICE_ROLE_KEY が誤って anon キーになっている場合に
// 早期に検出するため。
export function getServiceRoleStatus(): { ok: boolean; role: string | null; reason?: string } {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { ok: false, role: null, reason: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' };
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return { ok: false, role: null, reason: 'JWT 形式ではありません' };
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const role = payload?.role ?? null;
    if (role !== 'service_role') {
      return {
        ok: false,
        role,
        reason: `service_role が必要ですが、現在のキーの role は "${role}" です。Supabase ダッシュボード > Settings > API > "service_role" の secret をコピーして Vercel 環境変数 SUPABASE_SERVICE_ROLE_KEY に貼り付け、再デプロイしてください。`,
      };
    }
    return { ok: true, role };
  } catch {
    return { ok: false, role: null, reason: 'JWT のデコードに失敗しました' };
  }
}
