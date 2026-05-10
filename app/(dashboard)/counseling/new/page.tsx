'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/dashboard/page-header';
import { CounselingForm } from '@/components/counseling/counseling-form';
import { Field, Select } from '@/components/ui/input';

export default function NewCounselingPage() {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('stores')
      .select('id, name')
      .eq('is_active', true)
      .then(({ data }) => {
        const list = (data ?? []) as { id: string; name: string }[];
        setStores(list);
        setSelected(list[0]?.id ?? '');
      });
    supabase
      .from('counseling_settings')
      .select('disclaimer')
      .eq('id', 'default')
      .maybeSingle()
      .then(({ data }) => {
        setDisclaimer((data as any)?.disclaimer ?? null);
      });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader title="カウンセリング入力" description="店頭で代理入力する場合に使用します" />

      <Field label="対象店舗">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <CounselingForm storeId={selected || null} disclaimer={disclaimer} />
    </div>
  );
}
