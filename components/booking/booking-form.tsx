'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Slot {
  time: string;
  available: boolean;
}

export function BookingForm({ storeId }: { storeId: string; storeName: string }) {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [menu, setMenu] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function loadSlots() {
    setLoadingSlots(true);
    setError(null);
    setSelected(null);
    setSlots(null);
    try {
      const res = await fetch(
        `/api/book/availability?storeId=${encodeURIComponent(storeId)}&date=${date}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '空き状況の取得に失敗しました');
      setSlots(body.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submit() {
    if (!name.trim() || !phone.trim() || !selected) {
      setError('お名前・電話番号・時間をご入力ください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storeId,
          date,
          time: selected,
          name: name.trim(),
          phone: phone.trim(),
          menu: menu.trim(),
          notes: notes.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '予約に失敗しました');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '予約に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="font-serif text-lg text-ink-900">ご予約を受け付けました</h2>
          <p className="text-sm text-ink-500">
            {date} {selected} のご予約を承りました。
            <br />
            確定のご連絡をお待ちください。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <Field label="ご希望日">
          <div className="flex gap-2">
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlots(null);
                setSelected(null);
              }}
            />
            <Button variant="secondary" onClick={loadSlots} disabled={loadingSlots}>
              {loadingSlots ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Calendar size={14} />
              )}
              空き時間
            </Button>
          </div>
        </Field>

        {slots &&
          (slots.length === 0 ? (
            <p className="text-sm text-ink-500">
              この日は予約を受け付けていません。別の日をお選びください。
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setSelected(s.time)}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-sm transition-colors',
                    !s.available
                      ? 'cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300 line-through'
                      : selected === s.time
                        ? 'border-vivie-500 bg-vivie-500 text-white'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-vivie-300',
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
          ))}

        <Field label="お名前">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 花子" />
        </Field>
        <Field label="電話番号">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09012345678"
          />
        </Field>
        <Field label="ご希望メニュー (任意)">
          <Input value={menu} onChange={(e) => setMenu(e.target.value)} />
        </Field>
        <Field label="ご要望 (任意)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={submit} disabled={submitting || !selected}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          予約する
        </Button>
        <p className="text-center text-[11px] text-ink-400">
          送信後、サロンより確定のご連絡をいたします。
        </p>
      </CardContent>
    </Card>
  );
}
