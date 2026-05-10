'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Sparkles, Loader2, Save, Plus } from 'lucide-react';
import { formatYen } from '@/lib/utils';

interface Goal {
  id: string;
  store_id: string | null;
  goal_month: string;
  hpb_new_target: number;
  meta_new_target: number;
  minimo_new_target: number;
  referral_new_target: number;
  contract_target: number;
  sales_target: number;
  repeat_rate_target: number;
  notes: string | null;
  store?: { name: string } | null;
}

interface Props {
  stores: { id: string; name: string }[];
  goals: Goal[];
}

function nextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

export function GoalsClient({ stores, goals }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [month, setMonth] = useState(nextMonth());
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    hpb_new_target: 0,
    meta_new_target: 0,
    minimo_new_target: 0,
    referral_new_target: 0,
    contract_target: 0,
    sales_target: 0,
    repeat_rate_target: 0,
    notes: '',
  });

  async function generate() {
    setGenerating(true);
    setSuggestion(null);
    try {
      const res = await fetch('/api/ai/goal-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, target_month: month }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'AI 提案に失敗しました');
      setSuggestion(body.suggestion);
      // ドラフトに反映
      setDraft({
        hpb_new_target: body.suggestion?.kpis?.hpb_new_target ?? 0,
        meta_new_target: body.suggestion?.kpis?.meta_new_target ?? 0,
        minimo_new_target: body.suggestion?.kpis?.minimo_new_target ?? 0,
        referral_new_target: body.suggestion?.kpis?.referral_new_target ?? 0,
        contract_target: body.suggestion?.kpis?.contract_target ?? 0,
        sales_target: body.suggestion?.kpis?.sales_target ?? 0,
        repeat_rate_target: body.suggestion?.kpis?.repeat_rate_target ?? 0,
        notes: body.suggestion?.summary ?? '',
      });
      toast.show('AI 提案を生成しました', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '生成に失敗しました', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('monthly_goals').upsert(
        {
          store_id: storeId || null,
          goal_month: month,
          ...draft,
        },
        { onConflict: 'store_id,goal_month' },
      );
      if (error) throw error;
      toast.show('目標を保存しました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-vivie-200 bg-gradient-to-br from-vivie-50/40 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-vivie-500" size={18} />
            AI による目標提案
          </CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            過去 6 か月の日報データから、Claude AI が次月の現実的な目標を提案します。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="店舗">
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">全店舗</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="対象月">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button onClick={generate} disabled={generating} className="w-full">
                {generating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {generating ? '分析中…' : 'AI で目標を提案'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {suggestion && (
        <Card>
          <CardHeader>
            <CardTitle>AI からの提案</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-700 bg-ink-50/40 rounded-xl px-4 py-3">
              {suggestion.summary}
            </p>

            {suggestion.rationale?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-500 mb-1.5">根拠</p>
                <ul className="text-sm text-ink-700 list-disc pl-5 space-y-0.5">
                  {suggestion.rationale.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {suggestion.actions?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-vivie-700 mb-1.5">推奨アクション</p>
                <ul className="text-sm text-ink-700 list-disc pl-5 space-y-0.5">
                  {suggestion.actions.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 編集 / 保存 */}
      <Card>
        <CardHeader>
          <CardTitle>{month} の目標値</CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            AI 提案を反映 + 手動調整も可能。下記を確認のうえ保存してください
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumberField
              label="HPB 新規"
              value={draft.hpb_new_target}
              onChange={(v) => setDraft((d) => ({ ...d, hpb_new_target: v }))}
            />
            <NumberField
              label="Meta 新規"
              value={draft.meta_new_target}
              onChange={(v) => setDraft((d) => ({ ...d, meta_new_target: v }))}
            />
            <NumberField
              label="minimo 新規"
              value={draft.minimo_new_target}
              onChange={(v) => setDraft((d) => ({ ...d, minimo_new_target: v }))}
            />
            <NumberField
              label="紹介 新規"
              value={draft.referral_new_target}
              onChange={(v) => setDraft((d) => ({ ...d, referral_new_target: v }))}
            />
            <NumberField
              label="契約成立"
              value={draft.contract_target}
              onChange={(v) => setDraft((d) => ({ ...d, contract_target: v }))}
            />
            <NumberField
              label="売上目標 (円)"
              value={draft.sales_target}
              onChange={(v) => setDraft((d) => ({ ...d, sales_target: v }))}
              wide
            />
            <NumberField
              label="リピート率 (%)"
              value={draft.repeat_rate_target}
              onChange={(v) => setDraft((d) => ({ ...d, repeat_rate_target: v }))}
              max={100}
            />
          </div>
          <Field label="メモ">
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              <Save size={14} />
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 過去の目標 */}
      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>過去の目標</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>月</th>
                  <th>店舗</th>
                  <th className="text-right">HPB</th>
                  <th className="text-right">Meta</th>
                  <th className="text-right">minimo</th>
                  <th className="text-right">紹介</th>
                  <th className="text-right">契約</th>
                  <th className="text-right">売上</th>
                  <th className="text-right">リピ率</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id}>
                    <td className="text-xs whitespace-nowrap">{g.goal_month}</td>
                    <td className="text-xs">{g.store?.name ?? '全店舗'}</td>
                    <td className="text-right text-sm">{g.hpb_new_target}</td>
                    <td className="text-right text-sm">{g.meta_new_target}</td>
                    <td className="text-right text-sm">{g.minimo_new_target}</td>
                    <td className="text-right text-sm">{g.referral_new_target}</td>
                    <td className="text-right text-sm">{g.contract_target}</td>
                    <td className="text-right text-sm">{formatYen(g.sales_target)}</td>
                    <td className="text-right text-sm">{g.repeat_rate_target}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  max,
  wide,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <Field label={label}>
        <Input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      </Field>
    </div>
  );
}
