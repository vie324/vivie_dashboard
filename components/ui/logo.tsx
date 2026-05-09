import { cn } from '@/lib/utils';

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'mono' | 'pink';
  className?: string;
  withWordmark?: boolean;
  /**
   * 画像版を使用 (public/vivie-logo.png が必要)
   * デフォルトは false で wordmark のみ
   */
  asImage?: boolean;
}

const sizeClass = {
  xs: 'text-base h-6',
  sm: 'text-xl h-8',
  md: 'text-2xl h-10',
  lg: 'text-4xl h-14',
  xl: 'text-6xl h-20',
};

const imageSize = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export function Logo({
  size = 'md',
  variant = 'default',
  className,
  withWordmark = true,
  asImage = false,
}: Props) {
  if (asImage) {
    const px = imageSize[size];
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/vivie-logo.png"
        alt="vivie"
        width={px}
        height={px}
        className={cn('rounded-2xl object-cover', className)}
      />
    );
  }

  const colorClass =
    variant === 'mono'
      ? 'text-ink-900'
      : variant === 'pink'
        ? 'text-vivie-300'
        : 'text-vivie-500';

  return (
    <span
      className={cn(
        'font-serif tracking-wide leading-none inline-flex items-center',
        sizeClass[size],
        colorClass,
        className,
      )}
      style={{ letterSpacing: '0.08em' }}
      aria-label="vivie"
    >
      vivie
    </span>
  );
}

// ロゴ + 名前なしのアイコン (サイドバー等用)
export function LogoIcon({
  size = 'md',
  asImage = false,
  className,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  asImage?: boolean;
  className?: string;
}) {
  if (asImage) {
    const px = imageSize[size];
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/vivie-logo.png"
        alt="vivie"
        width={px}
        height={px}
        className={cn('rounded-2xl object-cover', className)}
      />
    );
  }
  // 画像がない場合のフォールバック: ピンク背景に "v" を白で
  const dim = imageSize[size];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-2xl bg-vivie-300 text-white font-serif font-medium',
        className,
      )}
      style={{ width: dim, height: dim, fontSize: dim * 0.5, letterSpacing: '-0.04em' }}
      aria-label="vivie"
    >
      v
    </span>
  );
}
