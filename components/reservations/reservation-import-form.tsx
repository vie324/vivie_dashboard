'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';

interface Props {
  stores: { id: string; name: string }[];
}

export function ReservationImportForm({ stores }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState('');
  const [preset, setPreset] = useState<'hpb' | 'minimo' | 'generic'>('hpb');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  async function runDry() {
    if (!storeId) {
      toast.show('店舗を選択してください', 'error');
      return;
    }
    setRunning(true);
    setPreview(null);
    try {
      const res = await fetch('/api/reservations/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, preset, store_id: storeId, dry_run: true }),
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
    if (!confirm(`${preview.total} 件を登録します。よろしいですか?`)) return;
    setRunning(true);
    try {
      const res = await fetch('/api/reservations/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, preset, store_id: storeId, dry_run: false }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '登録に失敗しました');
      toast.show(`${body.inserted} 件登録しました`, 'success');
      setPreview(null);
      setText('');
      router.push('/reservations');
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
          <CardTitle>① CSV データを貼り付け</CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            HPB (サロンボード) / minimo の管理画面からエクスポートした CSV を貼り付けます。
            ヘッダー行の列名で自動マッピングされます。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="媒体プリセット">
              <Select value={preset} onChange={(e) => setPreset(e.target.value as any)}>
                <option value="hpb">HPB (サロンボード)</option>
                <option value="minimo">minimo</option>
                <option value="generic">自由 (汎用)</option>
              </Select>
            </Field>
            <Field label="店舗" required>
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} required>
                <option value="">未選択</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="CSV / TSV データ">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder={`予約日時,お客様名,フリガナ,電話番号,メニュー,担当,予約ID
2026/05/15 14:00,山田 花子,ヤマダ ハナコ,09012345678,ハイドラ,粟田 麻央,12345`}
            />
          </Field>
          <p className="text-xs text-ink-500">
            <strong>列名 例:</strong> 予約日時 / 来店日 + 来店時間 / お客様名 / フリガナ /
            電話番号 / メニュー / スタッフ / 予約番号 / ステータス / 所要時間 / 金額 / 備考
          </p>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={runDry}
              disabled={running || !text.trim() || !storeId}
            >
              {running && <Loader2 size={14} className="animate-spin" />}
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
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="解析件数" value={preview.total} />
              <Stat
                label="解析エラー"
                value={preview.parse_errors?.length ?? 0}
                tone={preview.parse_errors?.length > 0 ? 'amber' : 'default'}
              />
              <Stat
                label="担当未マッチ"
                value={preview.unmatched_staff?.length ?? 0}
                tone={preview.unmatched_staff?.length > 0 ? 'amber' : 'default'}
              />
            </div>

            {preview.parse_errors?.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <p className="font-medium mb-1">
                  <AlertTriangle size={12} className="inline -mt-0.5 mr-1" />
                  解析エラー
                </p>
                <ul className="list-disc pl-5 space-y-0.5 max-h-32 overflow-y-auto">
                  {preview.parse_errors.slice(0, 10).map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.unmatched_staff?.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <p className="font-medium mb-1">staff テーブルに未登録の担当者</p>
                <p className="text-amber-700">{preview.unmatched_staff.join(', ')}</p>
                <p className="mt-1 text-amber-700">
                  紐付けなしでも登録可能です。後から手動で割当してください。
                </p>
              </div>
            )}

            {preview.preview?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-500 mb-1.5">最初の 5 件</p>
                <div className="overflow-x-auto rounded-xl border border-ink-100">
                  <table className="table-base text-xs">
                    <thead>
                      <tr>
                        <th>日時</th>
                        <th>お客様</th>
                        <th>メニュー</th>
                        <th>媒体</th>
                        <th>状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((p: any, i: number) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap">
                            {new Date(p.reservation_at).toLocaleString('ja-JP', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>{p.customer_name}</td>
                          <td className="text-ink-600">{p.menu ?? '—'}</td>
                          <td>
                            <Badge tone="default">{p.source}</Badge>
                          </td>
                          <td>
                            <Badge
                              tone={
                                p.status === 'cancelled' || p.status === 'no_show'
                                  ? 'red'
                                  : p.status === 'completed'
                                    ? 'default'
                                    : 'green'
                              }
                            >
                              {p.status}
                            </Badge>
                          </td>
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
              <Button onClick={commit} disabled={running || preview.total === 0}>
                {running ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {preview.total} 件を登録
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
  tone?: 'default' | 'green' | 'amber';
}) {
  const toneClass: Record<string, string> = {
    default: 'text-ink-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
  };
  return (
    <div className="rounded-xl bg-ink-50/40 border border-ink-100 px-3 py-2">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-0.5 font-serif text-2xl font-semibold ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}
