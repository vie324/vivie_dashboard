'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Loader2 } from 'lucide-react';

interface Props {
  stores: { id: string; name: string }[];
  initial?: {
    id?: string;
    full_name?: string;
    furigana?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    occupation?: string | null;
    birth_date?: string | null;
    primary_store_id?: string | null;
    notes?: string | null;
    status?: string;
  };
}

export function MemberForm({ stores, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? '',
    furigana: initial?.furigana ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    occupation: initial?.occupation ?? '',
    birth_date: initial?.birth_date ?? '',
    primary_store_id: initial?.primary_store_id ?? stores[0]?.id ?? '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'active',
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        ...form,
        source: 'manual',
        birth_date: form.birth_date || null,
        primary_store_id: form.primary_store_id || null,
      } as const;
      if (initial?.id) {
        const { error } = await supabase.from('members').update(payload).eq('id', initial.id);
        if (error) throw error;
        toast.show('更新しました', 'success');
      } else {
        const { error } = await supabase.from('members').insert(payload);
        if (error) throw error;
        toast.show('会員を登録しました', 'success');
      }
      router.push('/members');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="氏名" required>
              <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
            </Field>
            <Field label="フリガナ">
              <Input value={form.furigana ?? ''} onChange={(e) => update('furigana', e.target.value)} />
            </Field>
            <Field label="電話番号">
              <Input value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
            </Field>
            <Field label="メールアドレス">
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
            <Field label="生年月日">
              <Input
                type="date"
                value={form.birth_date ?? ''}
                onChange={(e) => update('birth_date', e.target.value)}
              />
            </Field>
            <Field label="職業">
              <Input
                value={form.occupation ?? ''}
                onChange={(e) => update('occupation', e.target.value)}
              />
            </Field>
            <Field label="所属店舗" className="sm:col-span-2">
              <Select
                value={form.primary_store_id ?? ''}
                onChange={(e) => update('primary_store_id', e.target.value)}
              >
                <option value="">未設定</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ステータス">
              <Select value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">在籍</option>
                <option value="paused">休会</option>
                <option value="cancelled">退会</option>
                <option value="lead">見込</option>
              </Select>
            </Field>
            <Field label="住所" className="sm:col-span-2">
              <Input value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} />
            </Field>
            <Field label="メモ" className="sm:col-span-2">
              <Textarea value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            キャンセル
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {initial?.id ? '更新する' : '登録する'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
