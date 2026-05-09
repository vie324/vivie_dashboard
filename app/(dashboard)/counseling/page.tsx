import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CounselingListView } from '@/components/counseling/counseling-list-view';
import { Plus, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CounselingListPage() {
  const supabase = createClient();
  const [{ data: records }, { data: stores }] = await Promise.all([
    supabase
      .from('counseling_records')
      .select(
        'id, full_name, furigana, phone, submitted_at, skin_concerns, face_concerns, body_concerns, goal_timeline, monthly_budget, reviewed_at, store:stores(name)',
      )
      .order('submitted_at', { ascending: false })
      .limit(200),
    supabase.from('stores').select('id, name').eq('is_active', true),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="カウンセリング一覧"
        description="お客様の悩みをひと目で確認 ・ カードをクリックで会話用の詳細表示"
        actions={
          <Link href="/counseling/new">
            <Button size="sm">
              <Plus size={14} />
              新規入力
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-medium text-ink-500">
            公開フォーム URL (お客様にお渡しください)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(stores ?? []).map((s: any) => (
              <Link
                key={s.id}
                href={`/counseling/public/${s.id}`}
                target="_blank"
                className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2.5 text-sm hover:bg-vivie-50/40"
              >
                <div>
                  <p className="font-medium text-ink-900">{s.name}</p>
                  <p className="text-xs text-ink-400">/counseling/public/{s.id}</p>
                </div>
                <ExternalLink size={14} className="text-ink-400" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <CounselingListView records={(records ?? []) as any} />
    </div>
  );
}
