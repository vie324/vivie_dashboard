'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import { RefreshCw, Save } from 'lucide-react';
import type { Staff } from '@/types/database';

interface StaffRow extends Staff {
  primary_store?: { name: string } | null;
}

export function StaffSettings({
  staff,
  stores,
  canEdit,
}: {
  staff: StaffRow[];
  stores: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(staff);

  function update(id: string, patch: Partial<Staff>) {
    setItems((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function save(s: StaffRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from('staff')
      .update({
        display_name: s.display_name,
        role: s.role,
        primary_store_id: s.primary_store_id,
        is_active: s.is_active,
      })
      .eq('id', s.id);
    if (error) toast.show(error.message, 'error');
    else {
      toast.show('保存しました', 'success');
      router.refresh();
    }
  }

  async function regenerateToken(id: string) {
    if (!confirm('日報用 URL を再発行しますか? 既存の URL は無効になります')) return;
    const supabase = createClient();
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const { error } = await supabase
      .from('staff')
      .update({ daily_report_token: newToken })
      .eq('id', id);
    if (error) toast.show(error.message, 'error');
    else {
      update(id, { daily_report_token: newToken });
      toast.show('URL を再発行しました', 'success');
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-ink-50/60 border border-ink-100 px-4 py-3 text-xs text-ink-600">
        新規スタッフを追加するには、Supabase ダッシュボードの Authentication &gt; Users から
        メール+パスワードでアカウントを作成し、その後 SQL で staff テーブルにレコードを
        追加してください。詳細は README.md をご参照ください。
      </div>

      {items.map((s) => {
        const url = s.daily_report_token
          ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/staff/report/${s.daily_report_token}`
          : '';
        return (
          <div key={s.id} className="rounded-xl border border-ink-100 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="表示名">
                <Input
                  value={s.display_name}
                  disabled={!canEdit}
                  onChange={(e) => update(s.id, { display_name: e.target.value })}
                />
              </Field>
              <Field label="メールアドレス">
                <Input value={s.email} disabled />
              </Field>
              <Field label="役割">
                <Select
                  value={s.role}
                  disabled={!canEdit}
                  onChange={(e) => update(s.id, { role: e.target.value as Staff['role'] })}
                >
                  <option value="admin">管理者</option>
                  <option value="manager">マネージャー</option>
                  <option value="staff">スタッフ</option>
                  <option value="store">店舗 (iPad / 店舗 PC)</option>
                </Select>
              </Field>
              <Field label="主担当店舗">
                <Select
                  value={s.primary_store_id ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => update(s.id, { primary_store_id: e.target.value || null })}
                >
                  <option value="">未設定</option>
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-3 rounded-xl bg-vivie-50/40 border border-vivie-100 p-3">
              <p className="text-xs font-medium text-vivie-700 mb-1.5">日報用 専用 URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-white border border-vivie-100 px-2.5 py-1.5 text-xs font-mono">
                  {url || '(未発行)'}
                </code>
                {url && <CopyButton value={url} />}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => regenerateToken(s.id)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-vivie-100 hover:text-vivie-600"
                    aria-label="再発行"
                    title="再発行"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Badge tone={s.is_active ? 'green' : 'default'}>
                {s.is_active ? '有効' : '無効'}
              </Badge>
              {canEdit && (
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update(s.id, { is_active: !s.is_active })}
                  >
                    {s.is_active ? '無効化' : '有効化'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => save(s)}>
                    <Save size={14} />
                    保存
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
