'use client';
import { useEffect, useState } from 'react';
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
  X,
  CreditCard,
  Activity,
  ShieldCheck,
  MessageCircle,
  Moon,
  Sun,
  Target,
  Ticket,
  CalendarDays,
  Scan,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { LogoIcon } from '@/components/ui/logo';
import type { Staff } from '@/types/database';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  showBadge?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: '概要',
    items: [{ href: '/', label: 'ダッシュボード', icon: LayoutDashboard }],
  },
  {
    label: '顧客',
    items: [
      { href: '/members', label: '会員管理', icon: Users },
      { href: '/reservations', label: '予約', icon: CalendarDays },
      { href: '/messages', label: 'LINE メッセージ', icon: MessageCircle, showBadge: true },
      { href: '/counseling', label: 'カウンセリング', icon: ClipboardList },
      { href: '/skin-analysis', label: '肌分析', icon: Scan },
      { href: '/treatments', label: '施術レポート', icon: Activity },
    ],
  },
  {
    label: '売上 / 運営',
    items: [
      { href: '/subscriptions', label: 'サブスク', icon: CreditCard },
      { href: '/tickets', label: '回数券', icon: Ticket },
      { href: '/cashbook', label: '出納帳', icon: Wallet },
      { href: '/reports', label: '日報', icon: FileBarChart2 },
      { href: '/goals', label: '目標管理', icon: Target },
      { href: '/attendance', label: '勤怠', icon: MapPin },
    ],
  },
  {
    label: '管理',
    adminOnly: true,
    items: [
      { href: '/admin', label: '管理コンソール', icon: ShieldCheck },
      { href: '/settings', label: '設定', icon: Settings },
    ],
  },
];

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
  const [unread, setUnread] = useState<number>(0);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // ダークモード初期化
    const saved = localStorage.getItem('vivie-theme');
    const isDark = saved === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('vivie-theme', next ? 'dark' : 'light');
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function load() {
      const { count } = await supabase
        .from('line_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .is('read_at', null);
      if (!cancelled) setUnread(count ?? 0);
    }
    load();
    const channel = supabase
      .channel('sidebar-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'line_messages' },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const visibleGroups = navGroups.filter((g) => !g.adminOnly || staff.role !== 'staff');

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
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-ink-100 bg-white transition-transform md:static md:translate-x-0 flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon size="sm" asImage />
            <span
              className="font-serif text-xl text-vivie-500"
              style={{ letterSpacing: '0.12em' }}
            >
              vivie
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-ink-100 md:hidden"
            aria-label="サイドバーを閉じる"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  const showBadge = item.showBadge && unread > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-vivie-50 text-vivie-700 font-medium'
                            : 'text-ink-700 hover:bg-ink-50',
                        )}
                      >
                        <Icon size={16} className={active ? 'text-vivie-500' : 'text-ink-500'} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="inline-flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full bg-vivie-500 px-1 text-[10px] font-medium text-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 px-3 py-3 shrink-0">
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-ink-500 hover:bg-ink-50"
            aria-label="テーマ切替"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            <span>{dark ? 'ライトモード' : 'ダークモード'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
