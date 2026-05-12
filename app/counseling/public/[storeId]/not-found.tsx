'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogoIcon } from '@/components/ui/logo';
import { ExternalLink, RefreshCw } from 'lucide-react';

export default function CounselingPublicNotFound() {
  const [openExternalHref, setOpenExternalHref] = useState<string | null>(null);
  const [isLineBrowser, setIsLineBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    const inLine = /Line\//i.test(ua);
    setIsLineBrowser(inLine);

    // LINE 内蔵ブラウザの古いキャッシュを破棄しつつ外部ブラウザで開くための URL
    const url = new URL(window.location.href);
    url.searchParams.set('openExternalBrowser', '1');
    url.searchParams.set('_ts', String(Date.now()));
    setOpenExternalHref(url.toString());
  }, []);

  function reload() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('_ts', String(Date.now()));
    window.location.href = url.toString();
  }

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
            ページを表示できません
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            お手数ですが、以下の方法をお試しください
          </p>
        </header>

        {isLineBrowser && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">⚠️ LINE 内のブラウザでは表示できないことがあります</p>
            <p className="text-xs text-amber-800">
              下のボタンから Safari / Chrome などの外部ブラウザでお開きください
            </p>
          </div>
        )}

        <div className="space-y-3">
          {openExternalHref && (
            <a
              href={openExternalHref}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-vivie-500 hover:bg-vivie-600 text-white py-3.5 text-sm font-medium shadow-sm"
            >
              <ExternalLink size={16} />
              外部ブラウザで開く
            </a>
          )}
          <button
            onClick={reload}
            className="flex items-center justify-center gap-2 w-full rounded-2xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 py-3.5 text-sm font-medium"
          >
            <RefreshCw size={16} />
            最新の状態で再読み込み
          </button>
          <Link
            href="/"
            className="block text-center text-xs text-ink-500 hover:text-vivie-600 pt-2"
          >
            トップに戻る
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-ink-100 bg-white/60 p-4 text-xs text-ink-500">
          <p className="font-semibold text-ink-700 mb-2">それでも表示できない場合</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>LINE アプリの設定 &gt; 一般 &gt; キャッシュ削除 を実行</li>
            <li>URL をコピーして Safari / Chrome に貼り付け</li>
            <li>スタッフにお声がけください</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
