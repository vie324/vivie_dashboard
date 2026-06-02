'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// (dashboard) 配下のエラーバウンダリ。
// サーバーコンポーネントの例外で汎用エラー画面に落ちないようにする。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertTriangle size={28} />
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-semibold text-ink-900">問題が発生しました</h2>
        <p className="max-w-sm text-sm text-ink-500">
          画面の読み込み中にエラーが発生しました。時間をおいて再度お試しください。
        </p>
        {error.digest && <p className="text-xs text-ink-400">エラー ID: {error.digest}</p>}
      </div>
      <Button onClick={reset}>再読み込み</Button>
    </div>
  );
}
