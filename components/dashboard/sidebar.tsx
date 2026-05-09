'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Wallet,
  FileBarChart2,
  MapPin,
  Settings,
  Sparkles,
  X,
  CreditCard,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Staff } from '@/types/database';

const baseItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/members', label: '会員管理', icon: Users },
  { href: '/subscriptions', label: 'サブスク', icon: CreditCard },
  { href: '/counseling', label: 'カウンセリング', icon: ClipboardList },
  { href: '/treatments', label: '施術レポート', icon: Activity },
  { href: '/cashbook', label: '出納帳', icon: Wallet },
  { href: '/reports', label: '日報', icon: FileBarChart2 },
  { href: '/attendance', label: '勤怠', icon: MapPin },
];

const adminItems = [{ href: '/settings', label: '設定', icon: Settings }];

export function Sidebar({
  staff,
  open,
  onClose,
}: {
  staff: Staff;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const items = [...baseItems, ...(staff.role !== 'staff' ? adminItems : [])];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-ink-100 bg-white transition-transform md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-vivie-100 text-vivie-600">
              <Sparkles size={18} />
            </span>
            <span className="font-serif text-lg font-semibold text-ink-900">Vivie</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-ink-100 md:hidden"
            aria-label="サイドバーを閉じる"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 pb-4">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-vivie-50 text-vivie-700 font-medium'
                        : 'text-ink-700 hover:bg-ink-50',
                    )}
                  >
                    <Icon size={18} className={active ? 'text-vivie-500' : 'text-ink-500'} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
