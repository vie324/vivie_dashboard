'use client';
import { useState } from 'react';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { ToastProvider } from '@/components/ui/toast';
import type { Staff } from '@/types/database';

export function DashboardShell({
  staff,
  children,
}: {
  staff: Staff;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar staff={staff} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar staff={staff} onMenuClick={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
