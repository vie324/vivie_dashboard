import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList, Plus, ExternalLink } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CounselingListPage() {
  const supabase = createClient();
  const [{ data: records }, { data: stores }] = await Promise.all([
    supabase
      .from('counseling_records')
      .select('id, full_name, phone, submitted_at, skin_concerns, face_concerns, reviewed_at, store:stores(name)')
      .order('submitted_at', { ascending: false })
      .limit(200),
    supabase.from('stores').select('id, name').eq('is_active', true),
  ]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="カウンセリング一覧"
        description="お客様から提出されたカウンセリングシートを確認します"
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
          <p className="text-xs font-medium text-ink-500">公開フォーム URL (お客様にお渡しください)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(stores ?? []).map((s) => (
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

      <Card>
        <CardContent className="p-0">
          {(records ?? []).length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={28} />}
              title="まだカウンセリングが提出されていません"
              description="公開フォームをお客様にお渡しいただくか、「新規入力」から手動で記録できます"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>提出日時</th>
                    <th>店舗</th>
                    <th>氏名</th>
                    <th>電話</th>
                    <th>主な悩み</th>
                    <th>確認</th>
                  </tr>
                </thead>
                <tbody>
                  {(records ?? []).map((r: any) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(r.submitted_at)}</td>
                      <td className="text-xs">{r.store?.name ?? '—'}</td>
                      <td>
                        <Link
                          href={`/counseling/${r.id}`}
                          className="font-medium text-ink-900 hover:text-vivie-600"
                        >
                          {r.full_name}
                        </Link>
                      </td>
                      <td className="text-xs text-ink-600">{r.phone}</td>
                      <td className="text-xs text-ink-600">
                        {[...(r.skin_concerns ?? []), ...(r.face_concerns ?? [])].slice(0, 3).join('、') || '—'}
                      </td>
                      <td>
                        {r.reviewed_at ? (
                          <Badge tone="green">確認済 {formatDate(r.reviewed_at)}</Badge>
                        ) : (
                          <Badge tone="amber">未確認</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
