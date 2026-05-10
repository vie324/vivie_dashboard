'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { CheckboxGroup, RadioGroup } from '@/components/ui/checkbox-group';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  VISIT_REASONS,
  PAST_TREATMENTS,
  SWITCH_REASONS,
  PAST_COMPLAINTS,
  SKIN_CONCERNS,
  FACE_CONCERNS,
  BODY_CONCERNS,
  GOAL_TIMELINES,
  MONTHLY_BUDGETS,
} from '@/lib/counseling-options';

interface Props {
  storeId?: string | null;
  storeName?: string;
  embed?: boolean; // 公開フォーム or 管理画面
  disclaimer?: string | null;
  onComplete?: () => void;
}

export function CounselingForm({ storeId, storeName, embed = false, disclaimer, onComplete }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    furigana: '',
    address: '',
    phone: '',
    birth_date: '',
    occupation: '',
    visit_reasons: [] as string[],
    visit_reason_other: '',
    past_treatments: [] as string[],
    switch_reason: '',
    switch_reason_other: '',
    past_complaints: [] as string[],
    past_complaints_other: '',
    skin_concerns: [] as string[],
    face_concerns: [] as string[],
    body_concerns: [] as string[],
    goal_timeline: '',
    monthly_budget: '',
    agreed_to_terms: false,
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.agreed_to_terms) {
      setError('規約への同意が必要です');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('counseling_records').insert({
        store_id: storeId ?? null,
        full_name: form.full_name,
        furigana: form.furigana || null,
        address: form.address || null,
        phone: form.phone,
        birth_date: form.birth_date || null,
        occupation: form.occupation || null,
        visit_reasons: form.visit_reasons,
        visit_reason_other: form.visit_reason_other || null,
        past_treatments: form.past_treatments,
        switch_reason: form.switch_reason || null,
        switch_reason_other: form.switch_reason_other || null,
        past_complaints: form.past_complaints,
        past_complaints_other: form.past_complaints_other || null,
        skin_concerns: form.skin_concerns,
        face_concerns: form.face_concerns,
        body_concerns: form.body_concerns,
        goal_timeline: form.goal_timeline || null,
        monthly_budget: form.monthly_budget || null,
        agreed_to_terms: form.agreed_to_terms,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
      if (onComplete) onComplete();
      else if (!embed) router.push('/counseling');
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="text-center py-12">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="font-serif text-2xl font-semibold">送信ありがとうございました</h2>
        <p className="mt-2 text-sm text-ink-500">
          スタッフが確認のうえ、ご来店時に詳しくお伺いいたします。
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {storeName && (
        <Card className="bg-vivie-50/60 border-vivie-100">
          <CardContent className="flex items-center gap-3 py-4">
            <Sparkles className="text-vivie-500" size={18} />
            <div>
              <p className="text-sm font-medium text-ink-900">{storeName}</p>
              <p className="text-xs text-ink-500">カウンセリングシート</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="氏名" required>
            <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
          </Field>
          <Field label="フリガナ">
            <Input value={form.furigana} onChange={(e) => update('furigana', e.target.value)} />
          </Field>
          <Field label="電話番号" required>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              required
            />
          </Field>
          <Field label="生年月日">
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => update('birth_date', e.target.value)}
            />
          </Field>
          <Field label="ご住所" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
          </Field>
          <Field label="ご職業" className="sm:col-span-2">
            <Input value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* 来店動機 */}
      <Card>
        <CardHeader>
          <CardTitle>当店をお選びいただいた理由 (複数選択可)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CheckboxGroup
            options={VISIT_REASONS}
            value={form.visit_reasons}
            onChange={(v) => update('visit_reasons', v)}
          />
          {form.visit_reasons.includes('other') && (
            <Field label="その他の詳細">
              <Input
                value={form.visit_reason_other}
                onChange={(e) => update('visit_reason_other', e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* 過去の施術 */}
      <Card>
        <CardHeader>
          <CardTitle>他店で受けたことがある施術</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckboxGroup
            options={PAST_TREATMENTS}
            value={form.past_treatments}
            onChange={(v) => update('past_treatments', v)}
            columns={3}
          />
        </CardContent>
      </Card>

      {/* 乗り換え理由 */}
      <Card>
        <CardHeader>
          <CardTitle>サロンを変えた理由</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            options={SWITCH_REASONS}
            value={form.switch_reason || null}
            onChange={(v) => update('switch_reason', v)}
          />
          {form.switch_reason === 'other' && (
            <Field label="その他の詳細">
              <Input
                value={form.switch_reason_other}
                onChange={(e) => update('switch_reason_other', e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* 過去の不満 */}
      <Card>
        <CardHeader>
          <CardTitle>前サロンで気になっていた点 (複数選択可)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CheckboxGroup
            options={PAST_COMPLAINTS}
            value={form.past_complaints}
            onChange={(v) => update('past_complaints', v)}
            columns={3}
          />
          {form.past_complaints.includes('other') && (
            <Field label="その他の詳細">
              <Input
                value={form.past_complaints_other}
                onChange={(e) => update('past_complaints_other', e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* 悩み */}
      <Card>
        <CardHeader>
          <CardTitle>お肌のお悩み</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckboxGroup
            options={SKIN_CONCERNS}
            value={form.skin_concerns}
            onChange={(v) => update('skin_concerns', v)}
            columns={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>お顔のお悩み</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckboxGroup
            options={FACE_CONCERNS}
            value={form.face_concerns}
            onChange={(v) => update('face_concerns', v)}
            columns={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>お身体のお悩み</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckboxGroup
            options={BODY_CONCERNS}
            value={form.body_concerns}
            onChange={(v) => update('body_concerns', v)}
            columns={2}
          />
        </CardContent>
      </Card>

      {/* 目標と予算 */}
      <Card>
        <CardHeader>
          <CardTitle>目標と予算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">目標までの期間</p>
            <RadioGroup
              options={GOAL_TIMELINES}
              value={form.goal_timeline || null}
              onChange={(v) => update('goal_timeline', v)}
              columns={2}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">毎月の美容予算</p>
            <RadioGroup
              options={MONTHLY_BUDGETS}
              value={form.monthly_budget || null}
              onChange={(v) => update('monthly_budget', v)}
              columns={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 注意事項 + 同意 */}
      <Card>
        {disclaimer && disclaimer.trim() && (
          <CardHeader>
            <CardTitle>注意事項・免責事項</CardTitle>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
              {disclaimer}
            </p>
          </CardHeader>
        )}
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreed_to_terms}
              onChange={(e) => update('agreed_to_terms', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-vivie-500 focus:ring-vivie-300"
            />
            <span className="text-sm text-ink-700">
              上記の注意事項・免責事項を理解し、同意のうえ情報を提供します。
            </span>
          </label>
        </CardContent>
        {error && (
          <CardFooter className="bg-red-50 text-red-700 text-sm">{error}</CardFooter>
        )}
        <CardFooter className="flex justify-end">
          <Button type="submit" size="lg" disabled={submitting || !form.agreed_to_terms}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            送信する
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
