'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Calendar } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface DailyRow {
  staff_id: string;
  store_id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  gross_minutes: number | null;
  break_starts: number;
  break_ends: number;
}

interface Props {
  initialMonth: string;
  staff: { id: string; display_name: string }[];
  stores: { id: string; name: string }[];
  daily: DailyRow[];
  staffMap: Map<string, string>;
  storeMap: Map<string, string>;
}

export function AttendanceSummary({
  initialMonth,
  staff,
  stores,
  daily,
  staffMap,
  storeMap,
}: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [staffId, setStaffId] = useState('');
  const [storeId, setStoreId] = useState('');

  const filtered = useMemo(
    () =>
      daily.filter((r) => {
        if (staffId && r.staff_id !== staffId) return false;
        if (storeId && r.store_id !== storeId) return false;
        return r.work_date.slice(0, 7) === month;
      }),
    [daily, staffId, storeId, month],
  );

  // スタッフ別集計
  const byStaff = useMemo(() => {
    const map = new Map<
      string,
      { name: string; days: number; totalMinutes: number; missingClockOut: number }
    >();
    filtered.forEach((r) => {
      const name = staffMap.get(r.staff_id) ?? '不明';
      const cur = map.get(r.staff_id) ?? { name, days: 0, totalMinutes: 0, missingClockOut: 0 };
      cur.days++;
      if (r.gross_minutes) cur.totalMinutes += r.gross_minutes;
      if (r.clock_in_at && !r.clock_out_at) cur.missingClockOut++;
      map.set(r.staff_id, cur);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [filtered, staffMap]);

  function exportCsv() {
    const headers = ['日付', 'スタッフ', '店舗', '出勤', '退勤', '実働(時間)', '休憩'];
    const rows = filtered.map((r) => [
      r.work_date,
      staffMap.get(r.staff_id) ?? '',
      storeMap.get(r.store_id) ?? '',
      r.clock_in_at ? new Date(r.clock_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '',
      r.clock_out_at ? new Date(r.clock_out_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '',
      r.gross_minutes ? (r.gross_minutes / 60).toFixed(2) : '',
      r.break_starts.toString(),
    ]);
    const csv =
      '﻿' +
      [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Field label="月" className="w-44">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field label="スタッフ" className="w-44">
              <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">全員</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="店舗" className="w-44">
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">全店舗</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button variant="secondary" size="md" onClick={exportCsv}>
            <Download size={14} />
            CSV
          </Button>
        </div>

        {/* スタッフ別集計 */}
        {byStaff.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {byStaff.map((s) => (
              <div key={s.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.missingClockOut > 0 && (
                    <Badge tone="amber" className="text-[10px]">
                      退勤打刻なし {s.missingClockOut}日
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                  <div>
                    <span className="text-ink-500">出勤日数</span>
                    <p className="font-serif text-base font-semibold text-ink-900">{s.days}日</p>
                  </div>
                  <div>
                    <span className="text-ink-500">総労働時間</span>
                    <p className="font-serif text-base font-semibold text-ink-900">
                      {(s.totalMinutes / 60).toFixed(1)}h
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 日次明細 */}
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-400">
            <Calendar size={32} className="mx-auto mb-2 text-ink-300" />
            この期間の打刻はありません
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="table-base">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>スタッフ</th>
                  <th>店舗</th>
                  <th>出勤</th>
                  <th>退勤</th>
                  <th className="text-right">実働</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const missing = r.clock_in_at && !r.clock_out_at;
                  const breakUnpaired = r.break_starts !== r.break_ends;
                  return (
                    <tr key={`${r.staff_id}-${r.work_date}`}>
                      <td className="whitespace-nowrap text-xs text-ink-500">{r.work_date}</td>
                      <td className="text-sm">{staffMap.get(r.staff_id) ?? '—'}</td>
                      <td className="text-xs text-ink-500">{storeMap.get(r.store_id) ?? '—'}</td>
                      <td className="text-xs">
                        {r.clock_in_at ? formatDateTime(r.clock_in_at).slice(11) : '—'}
                      </td>
                      <td className="text-xs">
                        {r.clock_out_at ? formatDateTime(r.clock_out_at).slice(11) : '—'}
                      </td>
                      <td className="text-right text-sm font-medium">
                        {r.gross_minutes ? `${(r.gross_minutes / 60).toFixed(2)}h` : '—'}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {missing && <Badge tone="amber" className="text-[10px]">退勤なし</Badge>}
                          {breakUnpaired && <Badge tone="amber" className="text-[10px]">休憩不一致</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
