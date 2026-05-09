'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Loader2, UserPlus } from 'lucide-react';

interface Props {
  stores: { id: string; name: string }[];
}

export function StaffInviteForm({ stores }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'staff' as 'admin' | 'manager' | 'staff',
    primary_store_id: stores[0]?.id ?? '',
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generatePassword() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let p = '';
    const rand = crypto.getRandomValues(new Uint8Array(12));
    for (let i = 0; i < 12; i++) p += chars[rand[i] % chars.length];
    update('password', p);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '作成に失敗しました');
      toast.show('スタッフを作成しました', 'success');
      setOpen(false);
      setForm({
        email: '',
        password: '',
        display_name: '',
        role: 'staff',
        primary_store_id: stores[0]?.id ?? '',
      });
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '作成に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={14} />
        スタッフを追加
      </Button>
    );
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader>
          <CardTitle>新規スタッフ追加</CardTitle>
          <p className="mt-1 text-xs text-ink-500">
            メールとパスワードを設定してアカウントを発行します。スタッフには別途パスワードを共有してください。
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="表示名" required>
            <Input
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
              required
              placeholder="山田 花子"
            />
          </Field>
          <Field label="役割">
            <Select
              value={form.role}
              onChange={(e) => update('role', e.target.value as any)}
            >
              <option value="staff">スタッフ</option>
              <option value="manager">マネージャー</option>
              <option value="admin">管理者</option>
            </Select>
          </Field>
          <Field label="メールアドレス" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </Field>
          <Field label="主担当店舗">
            <Select
              value={form.primary_store_id}
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
          <Field label="パスワード (8文字以上)" hint="作成後にスタッフへ共有してください" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={8}
                className="flex-1 font-mono"
              />
              <Button type="button" variant="ghost" size="sm" onClick={generatePassword}>
                自動生成
              </Button>
            </div>
          </Field>
        </CardContent>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-ink-100 bg-ink-50/40">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            作成
          </Button>
        </div>
      </form>
    </Card>
  );
}
