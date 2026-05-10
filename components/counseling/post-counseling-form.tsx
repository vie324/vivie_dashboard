'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Loader2, Save, Sparkles, Pencil } from 'lucide-react';

const CHANNEL_PRESETS = [
  'minimo',
  'HPB',
  'threads',
  'くまポン',
  'Mavie紹介',
  'Jicoo',
  'Instagram',
  'TikTok',
  '紹介',
  'その他',
];

const CLOSING_OPTIONS = [
  { value: 'closing', label: 'クロージング (契約)' },
  { value: 'next_reservation', label: '次回予約' },
  { value: 'none', label: 'なし (未契約・未予約)' },
  { value: 'other', label: 'その他' },
];

const PLAN_PRESETS = [
  '【月1回】Standardプラン',
  '【月2回】Standardプラン',
  '【月2回】Premiumプラン',
  '【月4回】Royalプラン',
];

interface Initial {
  assigned_staff_id: string | null;
  acquisition_channel: string | null;
  closing_status: string | null;
  closing_status_raw: string | null;
  next_reservation_date: string | null;
  no_contract_reason: string | null;
  contract_reason: string | null;
  contract_plan: string | null;
}

interface Props {
  recordId: string;
  staff: { id: string; display_name: string }[];
  initial: Initial;
}

export function PostCounselingForm({ recordId, staff, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assigned_staff_id: initial.assigned_staff_id ?? '',
    acquisition_channel: initial.acquisition_channel ?? '',
    closing_status: initial.closing_status ?? '',
    closing_status_raw: initial.closing_status_raw ?? '',
    next_reservation_date: initial.next_reservation_date ?? '',
    no_contract_reason: initial.no_contract_reason ?? '',
    contract_reason: initial.contract_reason ?? '',
    contract_plan: initial.contract_plan ?? '',
  });

  const isContracted = !!form.contract_plan && form.closing_status === 'closing';

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('counseling_records')
        .update({
          assigned_staff_id: form.assigned_staff_id || null,
          acquisition_channel: form.acquisition_channel || null,
          closing_status: form.closing_status || null,
          closing_status_raw: form.closing_status_raw || null,
          next_reservation_date: form.next_reservation_date || null,
          no_contract_reason: form.no_contract_reason || null,
          contract_reason: form.contract_reason || null,
          contract_plan: form.contract_plan || null,
          // 確認済みフラグも自動でセット
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', recordId);
      if (error) throw error;
      toast.show('施術後の情報を保存しました', 'success');
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  // 表示モード (編集中でない場合)
  if (!editing) {
    const assignee = staff.find((s) => s.id === form.assigned_staff_id);
    return (
      <Card className="border-vivie-200 bg-gradient-to-br from-vivie-50/40 to-white">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-vivie-500" />
            施術後の入力
          </CardTitle>
          <Button onClick={() => setEditing(true)} size="sm" variant="secondary">
            <Pencil size={14} />
            {form.assigned_staff_id ? '編集' : '入力'}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Info label="担当者" value={assignee?.display_name ?? '—'} />
          <Info label="来店経由" value={form.acquisition_channel ?? '—'} />
          <Info
            label="クロージング状態"
            value={
              CLOSING_OPTIONS.find((o) => o.value === form.closing_status)?.label ??
              form.closing_status_raw ??
              '—'
            }
          />
          <Info label="次回予約" value={form.next_reservation_date ?? '—'} />
          {form.contract_plan && (
            <Info
              label="契約コース"
              value={<span className="text-vivie-700 font-medium">{form.contract_plan}</span>}
            />
          )}
          {form.contract_reason && (
            <Info label="契約理由" value={form.contract_reason} className="sm:col-span-2" />
          )}
          {form.no_contract_reason && (
            <Info label="未契約理由" value={form.no_contract_reason} className="sm:col-span-2" />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={18} className="text-vivie-500" />
          施術後の入力
        </CardTitle>
        <p className="mt-1 text-xs text-ink-500">
          担当者・来店経由・クロージング・契約コースを記録します
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="担当者">
          <Select
            value={form.assigned_staff_id}
            onChange={(e) => update('assigned_staff_id', e.target.value)}
          >
            <option value="">未選択</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="来店経由" hint="マスタから選択 / 自由入力可">
          <Input
            list="channel-presets"
            value={form.acquisition_channel}
            onChange={(e) => update('acquisition_channel', e.target.value)}
            placeholder="例: minimo"
          />
          <datalist id="channel-presets">
            {CHANNEL_PRESETS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="クロージング状態">
          <Select
            value={form.closing_status}
            onChange={(e) => update('closing_status', e.target.value)}
          >
            <option value="">未選択</option>
            {CLOSING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="次回予約日 (任意)">
          <Input
            type="date"
            value={form.next_reservation_date}
            onChange={(e) => update('next_reservation_date', e.target.value)}
          />
        </Field>
        <Field label="自由メモ (元データの状態文)" className="sm:col-span-2" hint="例: 「検討したい」「都度がいい」など">
          <Input
            value={form.closing_status_raw}
            onChange={(e) => update('closing_status_raw', e.target.value)}
          />
        </Field>

        {/* 契約成立の場合 */}
        <Field label="契約コース" hint="契約成立時のみ入力 (例: 【月1回】Standardプラン)" className="sm:col-span-2">
          <Input
            list="plan-presets"
            value={form.contract_plan}
            onChange={(e) => update('contract_plan', e.target.value)}
            placeholder="未契約の場合は空欄でOK"
          />
          <datalist id="plan-presets">
            {PLAN_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="契約理由" className="sm:col-span-2">
          <Textarea
            value={form.contract_reason}
            onChange={(e) => update('contract_reason', e.target.value)}
            rows={2}
            placeholder="例: 効果を感じた、価格が魅力的だった"
          />
        </Field>
        <Field label="未契約理由" className="sm:col-span-2">
          <Textarea
            value={form.no_contract_reason}
            onChange={(e) => update('no_contract_reason', e.target.value)}
            rows={2}
            placeholder="例: 検討したい、お金ない、引っ越し予定"
          />
        </Field>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          キャンセル
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          <Save size={14} />
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-ink-900 mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
