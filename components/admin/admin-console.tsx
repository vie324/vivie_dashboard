'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Wallet, MapPin, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CashbookAdmin } from './cashbook-admin';
import { AttendanceAdmin } from './attendance-admin';
import { StaffUrlAdmin } from './staff-url-admin';

interface Props {
  currentTab: string;
  month: string;
  stores: { id: string; name: string }[];
  staff: any[];
  cashbook: any[];
  attendance: any[];
  canManageStaff: boolean;
}

const tabs = [
  { key: 'cashbook', label: '出納帳', icon: Wallet },
  { key: 'attendance', label: '勤怠', icon: MapPin },
  { key: 'urls', label: 'スタッフ URL', icon: Link2 },
];

export function AdminConsole({
  currentTab,
  month,
  stores,
  staff,
  cashbook,
  attendance,
  canManageStaff,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setTab(tab: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set('tab', tab);
    router.push(`/admin?${sp.toString()}`);
  }

  function setMonth(m: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set('month', m);
    router.push(`/admin?${sp.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* タブ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-2xl border border-ink-100 bg-white p-1 shadow-sm">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = currentTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-vivie-100 text-vivie-700'
                    : 'text-ink-500 hover:bg-ink-50',
                )}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {currentTab !== 'urls' && (
          <Field label="月" className="sm:w-48">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {currentTab === 'cashbook' && (
            <CashbookAdmin entries={cashbook} stores={stores} staff={staff} />
          )}
          {currentTab === 'attendance' && (
            <AttendanceAdmin logs={attendance} stores={stores} staff={staff} />
          )}
          {currentTab === 'urls' && <StaffUrlAdmin staff={staff} canManage={canManageStaff} />}
        </CardContent>
      </Card>
    </div>
  );
}
