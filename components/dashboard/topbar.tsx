'use client';
import { Menu, LogOut } from 'lucide-react';
import type { Staff } from '@/types/database';

const roleLabel: Record<Staff['role'], string> = {
  admin: '管理者',
  manager: 'マネージャー',
  staff: 'スタッフ',
};

const roleClass: Record<Staff['role'], string> = {
  admin: 'bg-vivie-100 text-vivie-700',
  manager: 'bg-amber-50 text-amber-700',
  staff: 'bg-ink-100 text-ink-700',
};

export function TopBar({
  staff,
  onMenuClick,
}: {
  staff: Staff;
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-ink-100 md:hidden"
          aria-label="メニュー"
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-ink-900 leading-tight">{staff.display_name}</p>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${roleClass[staff.role]}`}>
            {roleLabel[staff.role]}
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            aria-label="ログアウト"
            title="ログアウト"
          >
            <LogOut size={18} />
          </button>
        </form>
      </div>
    </header>
  );
}
