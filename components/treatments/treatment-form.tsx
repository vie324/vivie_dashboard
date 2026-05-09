'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Loader2, User, Search } from 'lucide-react';
import { todayISO } from '@/lib/utils';
import { ScoreInput } from './score-input';
import { ScoreRadar } from './radar-chart';
import { PhotoUploader } from './photo-uploader';
import {
  SKIN_AXES,
  FACE_AXES,
  BODY_AXES,
  emptyScores,
  type ScoreMap,
} from '@/lib/treatment-axes';

interface MemberOpt {
  id: string;
  full_name: string;
  furigana: string | null;
}

interface Props {
  members: MemberOpt[];
  stores: { id: string; name: string }[];
  staffId: string;
  defaultStoreId?: string | null;
}

export function TreatmentForm({ members, stores, staffId, defaultStoreId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberId, setMemberId] = useState<string>('');

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

  const selectedMember = members.find((m) => m.id === memberId);

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
  });
  const [skin, setSkin] = useState<ScoreMap>(emptyScores(SKIN_AXES));
  const [face, setFace] = useState<ScoreMap>(emptyScores(FACE_AXES));
  const [body, setBody] = useState<ScoreMap>(emptyScores(BODY_AXES));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) {
      toast.show('会員を選択してください', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('treatment_reports')
        .insert({
          member_id: memberId,
          store_id: form.store_id,
          staff_id: staffId,
          treatment_date: form.treatment_date,
          menu: form.menu || null,
          duration_minutes: form.duration_minutes || null,
          amount: form.amount || null,
          skin_scores: skin,
          face_scores: face,
          body_scores: body,
          before_photo_path: form.before_photo_path,
          after_photo_path: form.after_photo_path,
          observations: form.observations || null,
          next_recommendation: form.next_recommendation || null,
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
      {/* 会員選択 */}
      <Card>
        <CardHeader>
          <CardTitle>対象会員</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedMember ? (
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
              value={form.duration_minutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="金額 (円)">
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
            />
          </Field>
        </CardContent>
      </Card>

      {/* 写真 */}
      {memberId && (
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
              pathPrefix={`${memberId}/${form.treatment_date}`}
              value={form.before_photo_path}
              onChange={(path) => setForm((f) => ({ ...f, before_photo_path: path }))}
            />
            <PhotoUploader
              label="施術後 (After)"
              pathPrefix={`${memberId}/${form.treatment_date}`}
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

      <Card>
        <CardHeader>
          <CardTitle>体の状態 (1-5)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScoreInput axes={BODY_AXES} values={body} onChange={setBody} />
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            <ScoreRadar axes={BODY_AXES} current={body} />
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
