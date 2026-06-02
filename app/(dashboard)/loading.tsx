import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

// (dashboard) 配下の全ページ共通のローディング UI。
// データ取得中に空白画面ではなくスケルトンを表示する。
export default function Loading() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
