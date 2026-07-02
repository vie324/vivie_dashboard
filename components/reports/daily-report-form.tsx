'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn, formatYen, todayISO } from '@/lib/utils';

interface Props {
  stores: { id: string; name: string }[];
  staffId: string;
  staffName: string;
  defaultStoreId?: string | null;
  // 公開トークン経由の場合は token を渡す
  token?: string;
  // 編集モード
  initial?: any;
}

export function DailyReportForm({
  stores,
  staffId,
  staffName,
  defaultStoreId,
  token,
  initial,
}: Props) {
  const isEditing = !!initial?.id;
  const router = useRouter();
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    store_id: initial?.store_id ?? defaultStoreId ?? stores[0]?.id ?? '',
    report_date: initial?.report_date ?? todayISO(),
    hpb_new_count: initial?.hpb_new_count ?? 0,
    hpb_contract_count: initial?.hpb_contract_count ?? 0,
    meta_new_count: initial?.meta_new_count ?? 0,
    meta_contract_count: initial?.meta_contract_count ?? 0,
    minimo_new_count: initial?.minimo_new_count ?? 0,
    minimo_contract_count: initial?.minimo_contract_count ?? 0,
    referral_new_count: initial?.referral_new_count ?? 0,
    referral_contract_count: initial?.referral_contract_count ?? 0,
    existing_treatment_count: initial?.existing_treatment_count ?? 0,
    repeat_count: initial?.repeat_count ?? 0,
    // 媒体別の既存/リピート内訳 (任意)
    hpb_existing_count: initial?.hpb_existing_count ?? 0,
    hpb_repeat_count: initial?.hpb_repeat_count ?? 0,
    meta_existing_count: initial?.meta_existing_count ?? 0,
    meta_repeat_count: initial?.meta_repeat_count ?? 0,
    minimo_existing_count: initial?.minimo_existing_count ?? 0,
    minimo_repeat_count: initial?.minimo_repeat_count ?? 0,
    referral_existing_count: initial?.referral_existing_count ?? 0,
    referral_repeat_count: initial?.referral_repeat_count ?? 0,
    total_sales: initial?.total_sales ?? 0,
    discount_total: initial?.discount_total ?? 0,
    highlights: initial?.highlights ?? '',
    challenges: initial?.challenges ?? '',
    next_actions: initial?.next_actions ?? '',
  });

  function num<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: Number(value) || 0 } as typeof f));
  }

  const repeatRate = form.existing_treatment_count > 0
    ? Math.round((form.repeat_count / form.existing_treatment_count) * 100)
    : 0;
  const newTotal =
    form.hpb_new_count + form.meta_new_count + form.minimo_new_count + form.referral_new_count;
  const contractTotal =
    form.hpb_contract_count +
    form.meta_contract_count +
    form.minimo_contract_count +
    form.referral_contract_count;
  const mediaExistingTotal =
    form.hpb_existing_count +
    form.meta_existing_count +
    form.minimo_existing_count +
    form.referral_existing_count;
  const mediaRepeatTotal =
    form.hpb_repeat_count +
    form.meta_repeat_count +
    form.minimo_repeat_count +
    form.referral_repeat_count;

  // 送信前の整合性チェック (DB の CHECK 制約と同じ条件をクライアントでも弾く)
  function validate(): string | null {
    if (form.repeat_count > form.existing_treatment_count) {
      return 'リピート件数は既存施術件数を超えられません';
    }
    const medias: { label: string; e: number; r: number }[] = [
      { label: 'ホットペッパー', e: form.hpb_existing_count, r: form.hpb_repeat_count },
      { label: 'Meta 広告', e: form.meta_existing_count, r: form.meta_repeat_count },
      { label: 'minimo', e: form.minimo_existing_count, r: form.minimo_repeat_count },
      { label: '紹介', e: form.referral_existing_count, r: form.referral_repeat_count },
    ];
    for (const m of medias) {
      if (m.r > m.e) return `${m.label}: リピートが既存件数を超えています`;
    }
    if (mediaExistingTotal > form.existing_treatment_count) {
      return '媒体別の既存件数の合計が、既存施術件数の合計を超えています';
    }
    if (mediaRepeatTotal > form.repeat_count) {
      return '媒体別のリピート件数の合計が、リピート件数の合計を超えています';
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.store_id) {
      toast.show('店舗を選択してください', 'error');
      return;
    }
    const validationError = validate();
    if (validationError) {
      toast.show(validationError, 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (token) {
        const res = await fetch(`/api/staff/report/${token}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? '送信に失敗しました');
        }
      } else {
        const supabase = createClient();
        // 編集時は id を含めて既存行を更新する。id 無しの upsert だと店舗や日付を
        // 変更した瞬間に「新しい行の追加」になり、元の日報が残って二重計上される。
        const { error } = await supabase.from('daily_reports').upsert(
          {
            ...(isEditing ? { id: initial.id } : {}),
            ...form,
            staff_id: staffId,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: isEditing ? 'id' : 'store_id,staff_id,report_date' },
        );
        if (error) throw error;
      }
      toast.show('日報を送信しました', 'success');
      setSubmitted(true);
      if (!token) {
        router.push('/reports');
        router.refresh();
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '送信に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && token) {
    return (
      <Card className="text-center py-12">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="font-serif text-2xl font-semibold">日報を受け付けました</h2>
        <p className="mt-2 text-sm text-ink-500">
          {staffName}さん、お疲れさまでした。次回もよろしくお願いします。
        </p>
        <Button
          variant="secondary"
          className="mt-6 mx-auto"
          onClick={() => {
            setSubmitted(false);
            setForm((f) => ({ ...f, report_date: todayISO() }));
          }}
        >
          別の日の日報を入力
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="日付" required>
            <Input
              type="date"
              value={form.report_date}
              onChange={(e) => setForm((f) => ({ ...f, report_date: e.target.value }))}
              required
            />
          </Field>
          <Field label="店舗" required>
            <Select
              value={form.store_id}
              onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
              required
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>新規集客 (媒体ごとの来店 / 契約)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ChannelInput
              label="ホットペッパー"
              newCount={form.hpb_new_count}
              contract={form.hpb_contract_count}
              onNewChange={(v) => num('hpb_new_count', v)}
              onContractChange={(v) => num('hpb_contract_count', v)}
            />
            <ChannelInput
              label="Meta 広告"
              newCount={form.meta_new_count}
              contract={form.meta_contract_count}
              onNewChange={(v) => num('meta_new_count', v)}
              onContractChange={(v) => num('meta_contract_count', v)}
            />
            <ChannelInput
              label="minimo"
              newCount={form.minimo_new_count}
              contract={form.minimo_contract_count}
              onNewChange={(v) => num('minimo_new_count', v)}
              onContractChange={(v) => num('minimo_contract_count', v)}
            />
            <ChannelInput
              label="紹介"
              newCount={form.referral_new_count}
              contract={form.referral_contract_count}
              onNewChange={(v) => num('referral_new_count', v)}
              onContractChange={(v) => num('referral_contract_count', v)}
            />
          </div>
          <div className="rounded-xl bg-vivie-50/40 px-3 py-2 text-xs text-vivie-700">
            合計 新規 {newTotal}名 / 契約 {contractTotal}名
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>既存顧客 / リピート</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="既存顧客の施術件数" hint="本日施術した既存顧客の総数">
            <Input
              type="number"
              min={0}
              value={form.existing_treatment_count}
              onChange={(e) => num('existing_treatment_count', e.target.value)}
            />
          </Field>
          <Field label="うちリピート (再来) 件数">
            <Input
              type="number"
              min={0}
              max={form.existing_treatment_count}
              value={form.repeat_count}
              onChange={(e) => num('repeat_count', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            本日のリピート率: <strong>{repeatRate}%</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>媒体別リピート内訳 (任意)</CardTitle>
          <p className="mt-0.5 text-xs text-ink-500">
            分かる範囲で、既存施術のうち各媒体から来たお客様の件数とそのリピート(再来)件数を入力すると、媒体別リピート率が集計されます。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MediaRepeatInput
              label="ホットペッパー"
              existing={form.hpb_existing_count}
              repeat={form.hpb_repeat_count}
              onExistingChange={(v) => num('hpb_existing_count', v)}
              onRepeatChange={(v) => num('hpb_repeat_count', v)}
            />
            <MediaRepeatInput
              label="Meta 広告"
              existing={form.meta_existing_count}
              repeat={form.meta_repeat_count}
              onExistingChange={(v) => num('meta_existing_count', v)}
              onRepeatChange={(v) => num('meta_repeat_count', v)}
            />
            <MediaRepeatInput
              label="minimo"
              existing={form.minimo_existing_count}
              repeat={form.minimo_repeat_count}
              onExistingChange={(v) => num('minimo_existing_count', v)}
              onRepeatChange={(v) => num('minimo_repeat_count', v)}
            />
            <MediaRepeatInput
              label="紹介"
              existing={form.referral_existing_count}
              repeat={form.referral_repeat_count}
              onExistingChange={(v) => num('referral_existing_count', v)}
              onRepeatChange={(v) => num('referral_repeat_count', v)}
            />
          </div>
          <div
            className={cn(
              'rounded-xl px-3 py-2 text-xs',
              mediaExistingTotal > form.existing_treatment_count ||
                mediaRepeatTotal > form.repeat_count
                ? 'bg-red-50 text-red-700'
                : 'bg-ink-50 text-ink-600',
            )}
          >
            媒体別合計: 既存 {mediaExistingTotal} / 上記「既存施術件数」{form.existing_treatment_count}、
            リピート {mediaRepeatTotal} / 上記「リピート件数」{form.repeat_count}
            <span className="block text-[11px] text-ink-400 mt-0.5">
              ※ 媒体別合計は上の総数以下にしてください (媒体不明の分は入力不要です)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>売上</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="合計売上 (円)">
            <Input
              type="number"
              min={0}
              value={form.total_sales}
              onChange={(e) => num('total_sales', e.target.value)}
            />
          </Field>
          <Field label="うち割引額 (円)">
            <Input
              type="number"
              min={0}
              value={form.discount_total}
              onChange={(e) => num('discount_total', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
            実売上: <strong>{formatYen(form.total_sales - form.discount_total)}</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>所感</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="うまく行ったこと">
            <Textarea
              value={form.highlights}
              onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value }))}
            />
          </Field>
          <Field label="課題・気付き">
            <Textarea
              value={form.challenges}
              onChange={(e) => setForm((f) => ({ ...f, challenges: e.target.value }))}
            />
          </Field>
          <Field label="次回のアクション">
            <Textarea
              value={form.next_actions}
              onChange={(e) => setForm((f) => ({ ...f, next_actions: e.target.value }))}
            />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            送信する
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function MediaRepeatInput({
  label,
  existing,
  repeat,
  onExistingChange,
  onRepeatChange,
}: {
  label: string;
  existing: number;
  repeat: number;
  onExistingChange: (v: string) => void;
  onRepeatChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
      <p className="mb-2 text-xs font-medium text-ink-700">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="既存">
          <Input
            type="number"
            min={0}
            value={existing}
            onChange={(e) => onExistingChange(e.target.value)}
          />
        </Field>
        <Field label="リピート">
          <Input
            type="number"
            min={0}
            max={existing}
            value={repeat}
            onChange={(e) => onRepeatChange(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function ChannelInput({
  label,
  newCount,
  contract,
  onNewChange,
  onContractChange,
}: {
  label: string;
  newCount: number;
  contract: number;
  onNewChange: (v: string) => void;
  onContractChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
      <p className="mb-2 text-xs font-medium text-ink-700">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="来店">
          <Input type="number" min={0} value={newCount} onChange={(e) => onNewChange(e.target.value)} />
        </Field>
        <Field label="契約">
          <Input type="number" min={0} value={contract} onChange={(e) => onContractChange(e.target.value)} />
        </Field>
      </div>
    </div>
  );
}
