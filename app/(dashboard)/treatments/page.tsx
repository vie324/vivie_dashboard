import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { TreatmentsListView } from '@/components/treatments/treatments-list-view';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TreatmentsPage() {
  const supabase = createClient();
  const [{ data: reports }, { data: stores }, { data: staff }] = await Promise.all([
    supabase
      .from('treatment_reports')
      .select(
        '*, member:members(id, full_name, line_picture_url), staff:staff(id, display_name), store:stores(id, name)',
      )
      .order('treatment_date', { ascending: false })
      .limit(500),
    supabase.from('stores').select('id, name'),
    supabase.from('staff').select('id, display_name'),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="施術レポート"
        description="施術ごとの肌・顔のスコアと写真を記録、フォローアップ送信状況を一覧管理"
        actions={
          <Link href="/treatments/new">
            <Button size="sm">
              <Plus size={14} />
              新規入力
            </Button>
          </Link>
        }
      />
      <TreatmentsListView
        reports={(reports ?? []) as any}
        stores={(stores ?? []) as any}
        staff={(staff ?? []) as any}
      />
    </div>
  );
}
