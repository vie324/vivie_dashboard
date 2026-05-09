'use client';
import { useState } from 'react';
import { PeriodTabs, type PeriodKey } from './period-tabs';

// 現状はサーバー側で固定 (今月) のデータを表示。
// 期間タブを設置して「サブスク管理 / 出納帳 / 日報」の各画面に直接遷移できるようにする。
export function DashboardClient({
  children,
}: {
  initialMonth: string;
  children: React.ReactNode;
}) {
  const [period, setPeriod] = useState<PeriodKey>('month');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PeriodTabs value={period} onChange={setPeriod} />
        <p className="text-xs text-ink-400">
          ※ 詳細な期間集計は各管理画面でご確認ください
        </p>
      </div>
      {children}
    </div>
  );
}
