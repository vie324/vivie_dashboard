'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Loader2, User, Search, ClipboardList, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { todayISO } from '@/lib/utils';
import { ScoreInput } from './score-input';
import { ScoreRadar } from './radar-chart';
import { PhotoUploader } from './photo-uploader';
import {
  SKIN_AXES,
  FACE_AXES,
  emptyScores,
  type ScoreMap,
} from '@/lib/treatment-axes';

interface MemberOpt {
  id: string;
  full_name: string;
  furigana: string | null;
  line_picture_url?: string | null;
}

interface CounselingOpt {
  id: string;
  full_name: string;
  furigana: string | null;
  phone: string;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  member_id: string | null;
  submitted_at: string;
  store_id: string | null;
}

interface Props {
  members: MemberOpt[];
  stores: { id: string; name: string }[];
  counselings?: CounselingOpt[];
  staffId: string;
  defaultStoreId?: string | null;
}

export function TreatmentForm({
  members,
  stores,
  counselings = [],
  staffId,
  defaultStoreId,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberId, setMemberId] = useState<string>('');
  const [counselingId, setCounselingId] = useState<string>('');
  const [counselingQuery, setCounselingQuery] = useState('');

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members.slice(0, 30);
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.furigana ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [members, memberQuery]);

  const filteredCounselings = useMemo(() => {
    const q = counselingQuery.trim().toLowerCase();
    if (!q) return counselings.slice(0, 30);
    return counselings
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.furigana ?? '').toLowerCase().includes(q) ||
          c.phone.includes(q),
      )
      .slice(0, 30);
  }, [counselings, counselingQuery]);

  const selectedMember = members.find((m) => m.id === memberId);
  const selectedCounseling = counselings.find((c) => c.id === counselingId);

  const defaultExpiresAt = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })();

  const [form, setForm] = useState({
    store_id: defaultStoreId ?? stores[0]?.id ?? '',
    treatment_date: todayISO(),
    menu: '',
    duration_minutes: 60,
    amount: 0,
    observations: '',
    next_recommendation: '',
    before_photo_path: null as string | null,
    after_photo_path: null as string | null,
    is_first_visit: true,
    contracted: false,
    // フォローアップオファー (初回未契約のみ)
    offer_menu: '',
    offer_original_price: 0,
    offer_discounted_price: 0,
    offer_discount_label: '',
    offer_expires_at: defaultExpiresAt,
    offer_reservation_url: '',
    offer_notes: '',
  });
  const [skin, setSkin] = useState<ScoreMap>(emptyScores(SKIN_AXES));
  const [face, setFace] = useState<ScoreMap>(emptyScores(FACE_AXES));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    let resolvedMemberId = memberId;

    setSubmitting(true);
    try {
      const supabase = createClient();

      // 新規モード: カウンセリングから member を解決 / 必要なら作成
      if (mode === 'new') {
        if (!selectedCounseling) {
          toast.show('カウンセリングを選択してください', 'error');
          setSubmitting(false);
          return;
        }
        if (selectedCounseling.member_id) {
          resolvedMemberId = selectedCounseling.member_id;
        } else {
          // member 自動作成
          const { data: newMember, error: memberErr } = await supabase
            .from('members')
            .insert({
              full_name: selectedCounseling.full_name,
              furigana: selectedCounseling.furigana,
              phone: selectedCounseling.phone,
              birth_date: selectedCounseling.birth_date,
              address: selectedCounseling.address,
              occupation: selectedCounseling.occupation,
              source: 'manual',
              status: 'active',
              primary_store_id: selectedCounseling.store_id ?? form.store_id,
            })
            .select('id')
            .single();
          if (memberErr) throw memberErr;
          resolvedMemberId = (newMember as any).id;
          // counseling 側にも反映
          await supabase
            .from('counseling_records')
            .update({ member_id: resolvedMemberId })
            .eq('id', selectedCounseling.id);
        }
      } else {
        if (!memberId) {
          toast.show('既存会員を選択してください', 'error');
          setSubmitting(false);
          return;
        }
      }

      // フォローアップオファー: 初回未契約 かつ オファー入力ありの場合のみ保存
      const wantsOffer = form.is_first_visit && !form.contracted;
      const followupOffer = wantsOffer
        ? {
            menu: form.offer_menu || null,
            original_price: form.offer_original_price || null,
            discounted_price: form.offer_discounted_price || null,
            discount_label: form.offer_discount_label || null,
            expires_at: form.offer_expires_at || null,
            reservation_url: form.offer_reservation_url || null,
            notes: form.offer_notes || null,
          }
        : null;

      const { data, error } = await supabase
        .from('treatment_reports')
        .insert({
          member_id: resolvedMemberId,
          store_id: form.store_id,
          staff_id: staffId,
          treatment_date: form.treatment_date,
          menu: form.menu || null,
          duration_minutes: form.duration_minutes || null,
          amount: form.amount || null,
          skin_scores: skin,
          face_scores: face,
          body_scores: {},
          before_photo_path: form.before_photo_path,
          after_photo_path: form.after_photo_path,
          observations: form.observations || null,
          next_recommendation: form.next_recommendation || null,
          is_first_visit: mode === 'new' ? true : form.is_first_visit,
          contracted: form.contracted,
          followup_offer: followupOffer,
        })
        .select('id')
        .single();
      if (error) throw error;
      toast.show('施術レポートを登録しました', 'success');
      router.push(`/treatments/${(data as any).id}`);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* モード切替 */}
      <Card>
        <CardHeader>
          <CardTitle>対象お客様</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('new');
                setMemberId('');
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm transition-all',
                mode === 'new'
                  ? 'border-vivie-300 bg-vivie-50/60 text-vivie-700'
                  : 'border-ink-200 hover:bg-ink-50',
              )}
            >
              <ClipboardList size={18} />
              <span className="font-medium">新規来店</span>
              <span className="text-[10px] text-ink-400">カウンセリング済から選択</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('existing');
                setCounselingId('');
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm transition-all',
                mode === 'existing'
                  ? 'border-vivie-300 bg-vivie-50/60 text-vivie-700'
                  : 'border-ink-200 hover:bg-ink-50',
              )}
            >
              <UserCheck size={18} />
              <span className="font-medium">既存のお客様</span>
              <span className="text-[10px] text-ink-400">会員リストから選択</span>
            </button>
          </div>

          {mode === 'new' ? (
            selectedCounseling ? (
              <div className="flex items-center justify-between rounded-xl border border-vivie-200 bg-vivie-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-vivie-200">
                    <ClipboardList size={16} className="text-vivie-500" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{selectedCounseling.full_name}</p>
                    <p className="text-xs text-ink-400">
                      カウンセリング {selectedCounseling.submitted_at.slice(0, 10)}
                      {selectedCounseling.member_id ? ' ・ 会員紐付済' : ' ・ 自動で会員作成されます'}
                    </p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCounselingId('')}>
                  変更
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <Input
                    className="pl-9"
                    placeholder="氏名・フリガナ・電話で検索"
                    value={counselingQuery}
                    onChange={(e) => setCounselingQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-100">
                  {filteredCounselings.length === 0 ? (
                    <p className="p-3 text-sm text-ink-400 text-center">
                      過去 90 日のカウンセリングが見つかりません
                    </p>
                  ) : (
                    filteredCounselings.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setCounselingId(c.id)}
                        className="block w-full px-3 py-2 text-left hover:bg-vivie-50/40"
                      >
                        <p className="text-sm font-medium">{c.full_name}</p>
                        <p className="text-xs text-ink-400">
                          {c.furigana ?? c.phone} ・ 提出日 {c.submitted_at.slice(0, 10)}
                          {c.member_id && (
                            <span className="ml-2 inline-flex rounded bg-emerald-50 text-emerald-700 px-1.5 text-[10px] font-medium">
                              会員紐付済
                            </span>
                          )}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )
          ) : selectedMember ? (
            <div className="flex items-center justify-between rounded-xl border border-vivie-200 bg-vivie-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-vivie-200">
                  <User size={16} className="text-vivie-500" />
                </span>
                <div>
                  <p className="text-sm font-medium">{selectedMember.full_name}</p>
                  {selectedMember.furigana && (
                    <p className="text-xs text-ink-400">{selectedMember.furigana}</p>
                  )}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMemberId('')}>
                変更
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  className="pl-9"
                  placeholder="氏名・フリガナで検索"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-100">
                {filteredMembers.length === 0 ? (
                  <p className="p-3 text-sm text-ink-400 text-center">該当する会員が見つかりません</p>
                ) : (
                  filteredMembers.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setMemberId(m.id)}
                      className="block w-full px-3 py-2 text-left hover:bg-vivie-50/40"
                    >
                      <p className="text-sm font-medium">{m.full_name}</p>
                      {m.furigana && <p className="text-xs text-ink-400">{m.furigana}</p>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 来店区分 / 契約 */}
      <Card>
        <CardHeader>
          <CardTitle>来店区分</CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            初回来店で契約に至らなかった場合、本日の成果をフォローアップ LINE で送信できます
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ToggleCard
              checked={mode === 'new' ? true : form.is_first_visit}
              onChange={(v) => mode === 'existing' && setForm((f) => ({ ...f, is_first_visit: v }))}
              title="初回来店"
              hint={mode === 'new' ? '新規モードのため自動で ON' : '新規のお客様'}
            />
            <ToggleCard
              checked={form.contracted}
              onChange={(v) => setForm((f) => ({ ...f, contracted: v }))}
              title="契約成立"
              hint="サブスク契約あり"
              tone="green"
            />
          </div>
          {(mode === 'new' || form.is_first_visit) && !form.contracted && (
            <div className="rounded-xl bg-vivie-50/60 border border-vivie-200 px-4 py-3 text-sm text-vivie-700">
              💌 初回未契約のため、フォローアップ LINE 送信の対象です。下記にオファー内容を入力してください。
            </div>
          )}
        </CardContent>
      </Card>

      {/* フォローアップオファー (初回未契約のみ) */}
      {(mode === 'new' || form.is_first_visit) && !form.contracted && (
        <Card>
          <CardHeader>
            <CardTitle>フォローアップオファー</CardTitle>
            <p className="text-xs text-ink-500 mt-1">
              「あともう 1 回だけお得に来店できる」内容を設定します。LINE 送信時にこの情報を Flex Message に展開します。
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="特別メニュー">
              <Input
                value={form.offer_menu}
                onChange={(e) => setForm((f) => ({ ...f, offer_menu: e.target.value }))}
                placeholder="例: ハイドラフェイシャル"
              />
            </Field>
            <Field label="期限">
              <Input
                type="date"
                value={form.offer_expires_at}
                onChange={(e) => setForm((f) => ({ ...f, offer_expires_at: e.target.value }))}
              />
            </Field>
            <Field label="通常価格 (円)">
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.offer_original_price}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    offer_original_price: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                  }))
                }
              />
            </Field>
            <Field label="特別価格 (円)">
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.offer_discounted_price}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    offer_discounted_price: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                  }))
                }
              />
            </Field>
            <Field label="割引ラベル" hint="例: 約60% OFF / 1回限定">
              <Input
                value={form.offer_discount_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, offer_discount_label: e.target.value }))
                }
              />
            </Field>
            <Field label="予約 URL" hint="ボタンの遷移先">
              <Input
                type="url"
                value={form.offer_reservation_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, offer_reservation_url: e.target.value }))
                }
                placeholder="https://..."
              />
            </Field>
            <Field label="補足" className="sm:col-span-2">
              <Input
                value={form.offer_notes}
                onChange={(e) => setForm((f) => ({ ...f, offer_notes: e.target.value }))}
                placeholder="例: お一人様 1 回限り。ご予約時にこのメッセージを提示してください。"
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* 施術内容 */}
      <Card>
        <CardHeader>
          <CardTitle>施術内容</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="日付" required>
            <Input
              type="date"
              value={form.treatment_date}
              onChange={(e) => setForm((f) => ({ ...f, treatment_date: e.target.value }))}
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
          <Field label="メニュー" className="sm:col-span-2">
            <Input
              value={form.menu}
              onChange={(e) => setForm((f) => ({ ...f, menu: e.target.value }))}
              placeholder="例: ハイドラフェイシャル + 小顔矯正"
            />
          </Field>
          <Field label="所要時間 (分)">
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  duration_minutes: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                }))
              }
            />
          </Field>
          <Field label="金額 (円)">
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                }))
              }
            />
          </Field>
        </CardContent>
      </Card>

      {/* 写真 */}
      {(memberId || counselingId) && (
        <Card>
          <CardHeader>
            <CardTitle>写真 (任意)</CardTitle>
            <p className="text-xs text-ink-500 mt-1">
              施術前後を記録すると変化が分かりやすくなります
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PhotoUploader
              label="施術前 (Before)"
              pathPrefix={`${memberId || `c-${counselingId}`}/${form.treatment_date}`}
              value={form.before_photo_path}
              onChange={(path) => setForm((f) => ({ ...f, before_photo_path: path }))}
            />
            <PhotoUploader
              label="施術後 (After)"
              pathPrefix={`${memberId || `c-${counselingId}`}/${form.treatment_date}`}
              value={form.after_photo_path}
              onChange={(path) => setForm((f) => ({ ...f, after_photo_path: path }))}
            />
          </CardContent>
        </Card>
      )}

      {/* スコア + レーダー */}
      <Card>
        <CardHeader>
          <CardTitle>肌の状態 (1-5)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScoreInput axes={SKIN_AXES} values={skin} onChange={setSkin} />
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            <ScoreRadar axes={SKIN_AXES} current={skin} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>顔の状態 (1-5)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScoreInput axes={FACE_AXES} values={face} onChange={setFace} />
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            <ScoreRadar axes={FACE_AXES} current={face} />
          </div>
        </CardContent>
      </Card>

      {/* 所感 */}
      <Card>
        <CardHeader>
          <CardTitle>所感・次回提案</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="施術後の所感・お客様の反応">
            <Textarea
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              placeholder="施術中の様子、肌の反応、お客様の感想など"
            />
          </Field>
          <Field label="次回への提案・推奨">
            <Textarea
              value={form.next_recommendation}
              onChange={(e) => setForm((f) => ({ ...f, next_recommendation: e.target.value }))}
              placeholder="推奨メニュー、ホームケアアドバイス、次回までの目標など"
            />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            登録する
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  hint,
  tone = 'rose',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
  tone?: 'rose' | 'green';
}) {
  const activeClass =
    tone === 'green'
      ? 'border-emerald-300 bg-emerald-50/60 text-emerald-700'
      : 'border-vivie-300 bg-vivie-50/60 text-vivie-700';
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
        checked ? activeClass : 'border-ink-200 bg-white hover:bg-ink-50'
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 shrink-0 ${
          checked ? (tone === 'green' ? 'bg-emerald-500 border-emerald-500' : 'bg-vivie-400 border-vivie-400') : 'bg-white border-ink-300'
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-70">{hint}</p>
      </div>
    </button>
  );
}
