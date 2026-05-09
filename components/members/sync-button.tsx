'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { RefreshCcw, Loader2 } from 'lucide-react';

export function SquareSyncButton() {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = useState(false);

  async function sync() {
    setRunning(true);
    try {
      const res = await fetch('/api/square/sync', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        toast.show(body.error || 'Square 同期に失敗しました', 'error');
        if (body.hint) console.warn('hint:', body.hint);
        return;
      }
      const parts: string[] = [];
      if (body.members) parts.push(`会員 ${body.members}件`);
      if (body.subscriptions) parts.push(`サブスク ${body.subscriptions}件`);
      if (body.plans) parts.push(`プラン ${body.plans}件`);
      const warnings = (body.warnings ?? []) as string[];

      // 警告は最大 3 件まで集約。コンソールには全件出す。
      if (warnings.length > 0) {
        console.warn('Square sync warnings:', warnings);
      }
      const summary = warnings.length > 0
        ? `${warnings.length}件の警告あり (詳細はブラウザコンソール)`
        : '';

      if (parts.length === 0 && warnings.length > 0) {
        toast.show(`同期に問題があります: ${warnings[0].slice(0, 200)}`, 'error');
        if (warnings.length > 1) {
          toast.show(`他 ${warnings.length - 1} 件の警告 (コンソール参照)`, 'error');
        }
      } else {
        toast.show(
          parts.length ? `同期完了: ${parts.join(' / ')}` : '同期完了 (新規取得なし)',
          'success',
        );
        if (summary) toast.show(summary, 'info');
      }
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '通信エラー', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button onClick={sync} disabled={running} variant="secondary" size="sm">
      {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
      Square 同期
    </Button>
  );
}
