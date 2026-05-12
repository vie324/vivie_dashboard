'use client';
import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';

// LINE 内蔵ブラウザのキャッシュで表示崩れ / 404 が起きやすいため、
// 検知して「外部ブラウザで開く」誘導を出す
export function LineBrowserBanner() {
  const [show, setShow] = useState(false);
  const [externalHref, setExternalHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    if (!/Line\//i.test(ua)) return;

    // 一度閉じた人にはセッション内は再表示しない
    if (sessionStorage.getItem('vivie-line-banner-dismissed') === '1') return;

    const url = new URL(window.location.href);
    url.searchParams.set('openExternalBrowser', '1');
    setExternalHref(url.toString());
    setShow(true);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      sessionStorage.setItem('vivie-line-banner-dismissed', '1');
    } catch {}
  }

  if (!show || !externalHref) return null;

  return (
    <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-3 py-2">
      <div className="mx-auto max-w-2xl flex items-center gap-2 text-xs text-amber-900">
        <span className="flex-1 truncate">
          表示が崩れる場合は外部ブラウザでお開きください
        </span>
        <a
          href={externalHref}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 font-medium shrink-0"
        >
          <ExternalLink size={12} />
          外部で開く
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-amber-700 hover:bg-amber-100"
          aria-label="閉じる"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
