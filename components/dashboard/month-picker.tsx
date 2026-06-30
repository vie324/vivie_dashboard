'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

// URL の ?month=YYYY-MM を切り替える月セレクタ。サーバーコンポーネント側で searchParams.month を読む。
export function MonthPicker({
  value,
  paramName = 'month',
  className,
}: {
  value: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Input
      type="month"
      value={value}
      className={className ?? 'w-40'}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set(paramName, e.target.value);
        else params.delete(paramName);
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
