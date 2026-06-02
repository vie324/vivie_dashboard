'use client';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { TrendingUp } from 'lucide-react';
import { formatYen } from '@/lib/utils';

interface Props {
  reports: any[];
  staff: any[];
}

// 日報 (daily_reports) をスタッフ別に集計し、売上・契約・リピート率と
// 任意の歩合率による歩合額を試算する。
export function StaffSalesView({ reports, staff }: Props) {
  const [rate, setRate] = useState(0); // 歩合率 (%)

  const rows = useMemo(() => {
    const map = new Map<string, any>();
    (reports ?? []).forEach((r: any) => {
      const id = r.staff_id;
      if (!id) return;
      const cur =
        map.get(id) ??
        { staff_id: id, sales: 0, discount: 0, treatments: 0, repeat: 0, contracts: 0, days: 0 };
      cur.sales += r.total_sales ?? 0;
      cur.discount += r.discount_total ?? 0;
      cur.treatments += r.existing_treatment_count ?? 0;
      cur.repeat += r.repeat_count ?? 0;
      cur.contracts +=
        (r.hpb_contract_count ?? 0) +
        (r.meta_contract_count ?? 0) +
        (r.minimo_contract_count ?? 0) +
        (r.referral_contract_count ?? 0);
      cur.days += 1;
      map.set(id, cur);
    });
    const nameOf = new Map<string, string>();
    (staff ?? []).forEach((s: any) => nameOf.set(s.id, s.display_name));
    return Array.from(map.values())
      .map((r) => ({ ...r, name: nameOf.get(r.staff_id) ?? '不明' }))
      .sort((a, b) => b.sales - a.sales);
  }, [reports, staff]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          sales: acc.sales + r.sales,
          treatments: acc.treatments + r.treatments,
          repeat: acc.repeat + r.repeat,
          contracts: acc.contracts + r.contracts,
        }),
        { sales: 0, treatments: 0, repeat: 0, contracts: 0 },
      ),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp size={28} />}
        title="この月の日報がありません"
        description="日報が入力されると、スタッフ別の売上・契約数・リピート率を集計します。"
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="歩合率 (%)" className="w-32">
          <Input
            type="number"
            min={0}
            max={100}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
          />
        </Field>
        <p className="text-xs text-ink-500">
          日報の売上をスタッフ別に集計します。歩合率を入力すると歩合額を試算します。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>スタッフ</th>
              <th className="text-right">売上</th>
              <th className="text-right">施術数</th>
              <th className="text-right">契約数</th>
              <th className="text-right">リピート率</th>
              {rate > 0 && <th className="text-right">歩合 ({rate}%)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const repeatRate = r.treatments > 0 ? Math.round((r.repeat / r.treatments) * 100) : 0;
              return (
                <tr key={r.staff_id}>
                  <td className="text-sm font-medium">{r.name}</td>
                  <td className="text-right font-medium">{formatYen(r.sales)}</td>
                  <td className="text-right text-sm">{r.treatments}</td>
                  <td className="text-right text-sm">{r.contracts}</td>
                  <td className="text-right text-sm">{repeatRate}%</td>
                  {rate > 0 && (
                    <td className="text-right text-sm font-medium text-vivie-700">
                      {formatYen(Math.round((r.sales * rate) / 100))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-200 font-semibold">
              <td>合計</td>
              <td className="text-right">{formatYen(totals.sales)}</td>
              <td className="text-right">{totals.treatments}</td>
              <td className="text-right">{totals.contracts}</td>
              <td className="text-right">
                {totals.treatments > 0
                  ? Math.round((totals.repeat / totals.treatments) * 100)
                  : 0}
                %
              </td>
              {rate > 0 && (
                <td className="text-right text-vivie-700">
                  {formatYen(Math.round((totals.sales * rate) / 100))}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
