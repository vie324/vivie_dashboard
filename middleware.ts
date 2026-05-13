import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // LINE 内蔵ブラウザで /counseling/public/* にアクセスされたら
  // openExternalBrowser=1 を付けてリダイレクトし、Safari / Chrome 起動を強制する。
  // LINE 内蔵 WebView のキャッシュ詰まり (過去の 404 が残る) を回避する目的。
  if (url.pathname.startsWith('/counseling/public/')) {
    const ua = request.headers.get('user-agent') ?? '';
    if (/Line\//i.test(ua) && !url.searchParams.has('openExternalBrowser')) {
      const redirected = url.clone();
      redirected.searchParams.set('openExternalBrowser', '1');
      // デバイス側キャッシュも避けるため、リダイレクト先 URL に毎回変わる値を含める
      redirected.searchParams.set('_t', Date.now().toString(36));
      const res = NextResponse.redirect(redirected);
      // リダイレクトレスポンス自体もキャッシュさせない
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.headers.set('Pragma', 'no-cache');
      res.headers.set('Expires', '0');
      return res;
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
