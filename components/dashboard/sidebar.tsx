'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
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
  Scan,
  BarChart3,
  LineChart,
  Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { LogoIcon } from '@/components/ui/logo';
import type { Staff } from '@/types/database';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
  // 店舗ロール (iPad / 店舗 PC) でも表示する項目
  storeAllowed?: boolean;
  // admin / manager のみ表示する項目
  managerOnly?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: '概要',
    items: [{ href: '/', label: 'ダッシュボード', icon: LayoutDashboard, storeAllowed: true }],
  },
  {
    label: '顧客',
    items: [
      { href: '/members', label: '会員管理', icon: Users, storeAllowed: true },
      { href: '/messages', label: 'LINE メッセージ', icon: MessageCircle, showBadge: true, storeAllowed: true },
      { href: '/counseling', label: 'カウンセリング', icon: ClipboardList, storeAllowed: true },
      { href: '/skin-analysis', label: '肌分析', icon: Scan, storeAllowed: true },
      { href: '/treatments', label: '施術レポート', icon: Activity, storeAllowed: true },
    ],
  },
  {
    label: '売上 / 運営',
    items: [
      { href: '/sales', label: '売上分析', icon: LineChart, managerOnly: true },
      { href: '/subscriptions', label: 'サブスク', icon: CreditCard },
      { href: '/insights', label: '顧客インサイト', icon: Gem, managerOnly: true },
      { href: '/tickets', label: '回数券', icon: Ticket, storeAllowed: true },
      { href: '/cashbook', label: '出納帳', icon: Wallet, storeAllowed: true },
      { href: '/reports', label: '日報', icon: FileBarChart2 },
      { href: '/reports/analytics', label: '集客・契約分析', icon: BarChart3, managerOnly: true },
      { href: '/goals', label: '目標管理', icon: Target, managerOnly: true },
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

  // モバイルのドロワー表示中は Escape キーで閉じられるようにする
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

  const isStore = staff.role === 'store';
  const isManager = staff.role === 'admin' || staff.role === 'manager';
  const visibleGroups = navGroups
    .filter((g) => {
      // 店舗ロール: adminOnly グループは非表示
      if (isStore && g.adminOnly) return false;
      // スタッフロール: adminOnly グループは非表示
      if (!isStore && g.adminOnly && staff.role === 'staff') return false;
      return true;
    })
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        // 店舗ロール: storeAllowed=true の項目だけ表示
        if (isStore) return i.storeAllowed;
        // managerOnly の項目は admin / manager のみ
        if (i.managerOnly && !isManager) return false;
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);

  // 最も具体的に一致する項目だけをアクティブにする (例: /reports/analytics で 日報 が二重ハイライトしない)
  const activeHref = visibleGroups
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => (h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(h + '/')))
    .sort((a, b) => b.length - a.length)[0];

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
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-ink-100 bg-white/95 backdrop-blur transition-transform md:static md:translate-x-0 flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 shrink-0">
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoIcon size="sm" asImage />
            <span className="flex flex-col">
              <span
                className="font-serif text-xl text-vivie-500 transition-colors group-hover:text-vivie-600"
                style={{ letterSpacing: '0.14em' }}
              >
                vivie
              </span>
              <span className="gold-rule w-8" aria-hidden />
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

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-600/80">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  const showBadge = item.showBadge && unread > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200',
                          active
                            ? 'bg-gradient-to-r from-vivie-50 to-transparent text-vivie-700 font-medium'
                            : 'text-ink-700 hover:bg-ink-50 hover:translate-x-0.5',
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-gold-400 to-vivie-400"
                            aria-hidden
                          />
                        )}
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
