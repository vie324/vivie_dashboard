'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/ui/avatar';
import { Loader2, Search, User, X } from 'lucide-react';
import { todayISO } from '@/lib/utils';

interface MemberOpt {
  id: string;
  full_name: string;
  furigana: string | null;
  phone: string | null;
  line_picture_url: string | null;
}

interface Props {
  stores: { id: string; name: string }[];
  staff: { id: string; display_name: string }[];
  members: MemberOpt[];
  defaultStoreId?: string | null;
  initial?: any; // 編集モード
}

export function ReservationForm({ stores, staff, members, defaultStoreId, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberId, setMemberId] = useState<string | null>(initial?.member_id ?? null);

  const selectedMember = members.find((m) => m.id === memberId);
  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members.slice(0, 20);
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.furigana ?? '').toLowerCase().includes(q) ||
          (m.phone ?? '').includes(q),
      )
      .slice(0, 20);
  }, [members, memberQuery]);

  function pad(n: number) {
    return String(n).padStart(2, '0');
  }
  function isoToParts(iso: string) {
    const d = new Date(iso);
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }
  const initialParts = initial?.reservation_at ? isoToParts(initial.reservation_at) : null;

  const [form, setForm] = useState({
    customer_name: initial?.customer_name ?? '',
    customer_furigana: initial?.customer_furigana ?? '',
    customer_phone: initial?.customer_phone ?? '',
    customer_email: initial?.customer_email ?? '',
    source: initial?.source ?? 'phone',
    external_id: initial?.external_id ?? '',
    reservation_date: initialParts?.date ?? todayISO(),
    reservation_time: initialParts?.time ?? '14:00',
    duration_minutes: initial?.duration_minutes ?? 60,
    menu: initial?.menu ?? '',
    amount: initial?.amount ?? 0,
    staff_id: initial?.staff_id ?? '',
    store_id: initial?.store_id ?? defaultStoreId ?? stores[0]?.id ?? '',
    status: initial?.status ?? 'confirmed',
    notes: initial?.notes ?? '',
  });

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pickMember(m: MemberOpt) {
    setMemberId(m.id);
    setForm((f) => ({
      ...f,
      customer_name: m.full_name,
      customer_furigana: m.furigana ?? '',
      customer_phone: m.phone ?? '',
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.show('お客様名を入力してください', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const dateTime = new Date(`${form.reservation_date}T${form.reservation_time}`);
      const payload = {
        member_id: memberId || null,
        customer_name: form.customer_name,
        customer_furigana: form.customer_furigana || null,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        source: form.source,
        external_id: form.external_id || null,
        reservation_at: dateTime.toISOString(),
        duration_minutes: Number(form.duration_minutes) || 60,
        menu: form.menu || null,
        amount: Number(form.amount) || null,
        staff_id: form.staff_id || null,
        store_id: form.store_id,
        status: form.status,
        notes: form.notes || null,
      };
      if (initial?.id) {
        const { error } = await supabase.from('reservations').update(payload).eq('id', initial.id);
        if (error) throw error;
        toast.show('予約を更新しました', 'success');
      } else {
        const { error } = await supabase.from('reservations').insert(payload);
        if (error) throw error;
        toast.show('予約を登録しました', 'success');
      }
      router.push('/reservations');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '保存に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* 会員紐付け */}
      <Card>
        <CardHeader>
          <CardTitle>会員紐付け (任意)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedMember ? (
            <div className="flex items-center justify-between rounded-xl border border-vivie-200 bg-vivie-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={selectedMember.full_name} src={selectedMember.line_picture_url} size="sm" />
                <div>
                  <p className="text-sm font-medium">{selectedMember.full_name}</p>
                  <p className="text-xs text-ink-400">
                    {selectedMember.furigana ?? ''} {selectedMember.phone ?? ''}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMemberId(null)}
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  className="pl-9"
                  placeholder="氏名・フリガナ・電話で検索 (空欄でも保存可能)"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
              </div>
              {memberQuery.trim() && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-100">
                  {filteredMembers.length === 0 ? (
                    <p className="p-3 text-sm text-ink-400 text-center">該当する会員がいません</p>
                  ) : (
                    filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMember(m)}
                        className="block w-full px-3 py-2 text-left hover:bg-vivie-50/40"
                      >
                        <p className="text-sm font-medium">{m.full_name}</p>
                        <p className="text-xs text-ink-400">
                          {m.furigana ?? ''} {m.phone ?? ''}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
              <p className="text-xs text-ink-500">
                <User size={11} className="inline -mt-0.5 mr-1" />
                電話番号が会員と一致すれば、保存時に自動で紐付きます
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* お客様情報 */}
      <Card>
        <CardHeader>
          <CardTitle>お客様情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="お客様名" required>
            <Input
              value={form.customer_name}
              onChange={(e) => update('customer_name', e.target.value)}
              required
            />
          </Field>
          <Field label="フリガナ">
            <Input
              value={form.customer_furigana}
              onChange={(e) => update('customer_furigana', e.target.value)}
            />
          </Field>
          <Field label="電話番号">
            <Input
              type="tel"
              value={form.customer_phone}
              onChange={(e) => update('customer_phone', e.target.value)}
            />
          </Field>
          <Field label="メール">
            <Input
              type="email"
              value={form.customer_email}
              onChange={(e) => update('customer_email', e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* 予約内容 */}
      <Card>
        <CardHeader>
          <CardTitle>予約内容</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="予約日" required>
            <Input
              type="date"
              value={form.reservation_date}
              onChange={(e) => update('reservation_date', e.target.value)}
              required
            />
          </Field>
          <Field label="開始時刻" required>
            <Input
              type="time"
              value={form.reservation_time}
              onChange={(e) => update('reservation_time', e.target.value)}
              required
            />
          </Field>
          <Field label="所要時間 (分)">
            <Input
              type="number"
              min={15}
              step={15}
              value={form.duration_minutes}
              onChange={(e) => update('duration_minutes', Number(e.target.value) || 60)}
            />
          </Field>
          <Field label="金額 (円)">
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => update('amount', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="メニュー" className="sm:col-span-2">
            <Input
              value={form.menu}
              onChange={(e) => update('menu', e.target.value)}
              placeholder="例: ハイドラフェイシャル + 小顔矯正"
            />
          </Field>
          <Field label="店舗" required>
            <Select
              value={form.store_id}
              onChange={(e) => update('store_id', e.target.value)}
              required
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="担当スタッフ">
            <Select value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)}>
              <option value="">未指定</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="媒体">
            <Select value={form.source} onChange={(e) => update('source', e.target.value)}>
              <option value="phone">電話</option>
              <option value="direct">直接</option>
              <option value="hpb">HPB</option>
              <option value="minimo">minimo</option>
              <option value="line">LINE</option>
              <option value="instagram">Instagram</option>
              <option value="threads">Threads</option>
              <option value="other">その他</option>
            </Select>
          </Field>
          <Field label="状態">
            <Select value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="confirmed">予約確定</option>
              <option value="pending">仮予約</option>
              <option value="completed">来店済</option>
              <option value="cancelled">キャンセル</option>
              <option value="no_show">無断欠席</option>
            </Select>
          </Field>
          <Field label="外部 ID (HPB / minimo の予約番号)" className="sm:col-span-2">
            <Input
              value={form.external_id}
              onChange={(e) => update('external_id', e.target.value)}
            />
          </Field>
          <Field label="備考" className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
            />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {initial?.id ? '更新' : '登録'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
