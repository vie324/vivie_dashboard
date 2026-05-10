'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Loader2, Save } from 'lucide-react';

interface Props {
  initialDisclaimer: string;
  canEdit: boolean;
}

export function CounselingSettings({ initialDisclaimer, canEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(initialDisclaimer);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('counseling_settings')
        .upsert({ id: 'default', disclaimer: value });
      if (error) throw error;
      toast.show('注意事項を保存しました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        公開カウンセリングフォームの末尾に表示される注意事項・免責事項です。
        改行はそのまま反映されます。
      </p>
      <Textarea
        rows={14}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!canEdit}
        className="font-mono text-xs leading-relaxed"
      />
      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-ink-400">{value.length} 文字</span>
          <Button size="sm" onClick={save} disabled={saving || value === initialDisclaimer}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </Button>
        </div>
      )}
    </div>
  );
}
