'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  stores: { id: string; name: string }[];
}

export function CounselingImportForm({ stores }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tsv, setTsv] = useState('');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  async function runDry() {
    setRunning(true);
    setPreview(null);
    try {
      const res = await fetch('/api/counseling/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tsv, store_id: storeId, dry_run: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'プレビューに失敗しました');
      setPreview(body);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'プレビューに失敗しました', 'error');
    } finally {
      setRunning(false);
    }
  }

  async function commit() {
    if (!preview) return;
    if (!confirm(`${preview.new_records} 件をデータベースに登録します。よろしいですか?`)) return;
    setRunning(true);
    try {
      const res = await fetch('/api/counseling/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tsv, store_id: storeId, dry_run: false }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '登録に失敗しました');
      toast.show(
        `${body.inserted} 件登録 (重複スキップ ${body.duplicates} 件)`,
        'success',
      );
      if (body.inserted > 0) {
        toast.show(
          '住所のジオコーディングは /counseling/map から実行できます',
          'info',
        );
      }
      setPreview(null);
      setTsv('');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '登録に失敗しました', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>① TSV データを貼り付け</CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            スプレッドシートで対象範囲をコピー → 下のテキストエリアにそのまま貼り付け。
            ヘッダ行 (タイムスタンプ…) があっても自動で除外します。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="店舗 (該当しない時は空)">
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">未設定</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="TSV データ">
            <Textarea
              value={tsv}
              onChange={(e) => setTsv(e.target.value)}
              rows={12}
              placeholder="2025/09/15 12:38:39\t木山友里\tキヤマユリ\t..."
              className="font-mono text-xs"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={runDry}
              disabled={running || !tsv.trim()}
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : null}
              プレビュー
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-vivie-200">
          <CardHeader>
            <CardTitle>② プレビュー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="解析件数" value={preview.total_parsed} />
              <Stat label="登録予定" value={preview.new_records} tone="green" />
              <Stat label="重複" value={preview.duplicates} tone="amber" />
              <Stat
                label="担当未マッチ"
                value={preview.unmatched_staff?.length ?? 0}
                tone={preview.unmatched_staff?.length > 0 ? 'red' : 'default'}
              />
            </div>

            {preview.unmatched_staff?.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <p className="font-medium mb-1">
                  <AlertTriangle size={12} className="inline -mt-0.5 mr-1" />
                  staff テーブルに登録のない担当者
                </p>
                <p className="text-amber-700">
                  {preview.unmatched_staff.join(', ')}
                </p>
                <p className="mt-1 text-amber-700">
                  該当スタッフを設定 &gt; スタッフから先に登録すると自動で紐付きます。
                  紐付けなしでも登録は可能 (assigned_staff_name に名前テキストが残ります)。
                </p>
              </div>
            )}

            {preview.preview?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-500 mb-1.5">
                  最初の {preview.preview.length} 件
                </p>
                <div className="overflow-x-auto rounded-xl border border-ink-100">
                  <table className="table-base text-xs">
                    <thead>
                      <tr>
                        <th>提出日</th>
                        <th>氏名</th>
                        <th>担当</th>
                        <th>媒体</th>
                        <th>状態</th>
                        <th>契約プラン</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((p: any, i: number) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap">
                            {p.submitted_at?.slice(0, 10)}
                          </td>
                          <td>{p.full_name}</td>
                          <td>
                            {p.assigned_staff_id ? (
                              <Badge tone="green">マッチ</Badge>
                            ) : (
                              <span className="text-amber-700">{p.assigned_staff_name}</span>
                            )}
                          </td>
                          <td>{p.acquisition_channel ?? '—'}</td>
                          <td>{p.closing_status ?? '—'}</td>
                          <td>{p.contract_plan ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                キャンセル
              </Button>
              <Button onClick={commit} disabled={running || preview.new_records === 0}>
                {running ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {preview.new_records} 件を登録する
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'green' | 'amber' | 'red';
}) {
  const toneClass: Record<string, string> = {
    default: 'text-ink-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  };
  return (
    <div className="rounded-xl bg-ink-50/40 border border-ink-100 px-3 py-2.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-semibold ${toneClass[tone]}`}>
        {value}
      </p>
    </div>
  );
}
