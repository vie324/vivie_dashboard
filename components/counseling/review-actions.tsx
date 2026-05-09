'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Check, RotateCcw } from 'lucide-react';

export function CounselingReviewActions({
  id,
  reviewed,
}: {
  id: string;
  reviewed: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('counseling_records')
        .update({
          reviewed_at: reviewed ? null : new Date().toISOString(),
          reviewed_by: reviewed ? null : user?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
      toast.show(reviewed ? '未確認に戻しました' : '確認済みにしました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '更新に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button onClick={toggle} disabled={submitting} size="sm" variant={reviewed ? 'secondary' : 'primary'}>
      {reviewed ? (
        <>
          <RotateCcw size={14} />
          未確認に戻す
        </>
      ) : (
        <>
          <Check size={14} />
          確認済みにする
        </>
      )}
    </Button>
  );
}
