'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select, Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Loader2, MapPin, Filter, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';

// Leaflet は SSR で window を使うため client only
const MapBoard = dynamic(() => import('./map-board').then((m) => m.MapBoard), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center text-sm text-ink-400">
      <Loader2 size={20} className="mr-2 animate-spin" />
      地図を読み込んでいます…
    </div>
  ),
});

export interface MapPoint {
  id: string;
  full_name: string;
  acquisition_channel: string | null;
  contract_plan: string | null;
  closing_status: string | null;
  geo_lat: number;
  geo_lng: number;
  address: string | null;
  submitted_at: string;
}

interface UnresolvedRow {
  id: string;
  full_name: string;
  address: string | null;
  geo_error?: string | null;
  geo_attempted_at?: string | null;
}

interface Props {
  points: MapPoint[];
  unresolvedCount: number;
  untriedCount?: number;
  failedCount?: number;
  addressedTotal?: number;
  unresolvedSamples?: UnresolvedRow[];
  failedSamples?: UnresolvedRow[];
}

export function CounselingMapView({
  points,
  unresolvedCount,
  untriedCount = 0,
  failedCount = 0,
  addressedTotal = 0,
  unresolvedSamples = [],
  failedSamples = [],
}: Props) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState('');
  const [contractFilter, setContractFilter] = useState<'all' | 'contracted' | 'not_contracted'>('all');

  const channels = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => p.acquisition_channel && set.add(p.acquisition_channel));
    return Array.from(set).sort();
  }, [points]);

  const filtered = useMemo(() => {
    return points.filter((p) => {
      if (channelFilter && p.acquisition_channel !== channelFilter) return false;
      if (contractFilter === 'contracted' && !p.contract_plan) return false;
      if (contractFilter === 'not_contracted' && p.contract_plan) return false;
      return true;
    });
  }, [points, channelFilter, contractFilter]);

  // 媒体別集計
  const channelStats = useMemo(() => {
    const map = new Map<string, { total: number; contracted: number }>();
    for (const p of filtered) {
      const key = p.acquisition_channel ?? '不明';
      const cur = map.get(key) ?? { total: 0, contracted: 0 };
      cur.total++;
      if (p.contract_plan) cur.contracted++;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, rate: v.total > 0 ? Math.round((v.contracted / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  async function runBatch(limit = 20) {
    if (!confirm(`未解決の住所を最大 ${limit} 件まで処理します (約 ${limit * 1.5} 秒)。続行しますか?`)) return;
    setRunning(true);
    try {
      const res = await fetch('/api/counseling/geocode-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit, retry_failed: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗しました');
      toast.show(
        `処理 ${body.processed} 件 / 解決 ${body.resolved} / 失敗 ${body.failed}`,
        body.resolved > 0 ? 'success' : 'info',
      );
      window.location.reload();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setRunning(false);
    }
  }

  async function retryOne(id: string) {
    setRetrying(id);
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗しました');
      toast.show('解決しました。地図を更新します', 'success');
      window.location.reload();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setRetrying(null);
    }
  }

  const resolvedCount = points.length;
  const unresolvedActual = Math.max(0, addressedTotal - resolvedCount);

  return (
    <div className="space-y-4">
      {/* ステータスサマリ + ジオコード処理 */}
      <Card className="border-vivie-200">
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
              <Stat label="住所あり" value={addressedTotal} />
              <Stat label="解決済 (地図表示)" value={resolvedCount} tone="green" />
              <Stat label="未試行" value={untriedCount} tone="amber" />
              <Stat label="失敗 (リトライ可)" value={failedCount} tone="red" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
            <p className="text-xs text-ink-500 mr-auto">
              未解決の住所を緯度経度に変換します (1 件あたり約 1 秒)
            </p>
            <Button
              onClick={() => runBatch(20)}
              disabled={running || unresolvedActual === 0}
              variant="secondary"
              size="sm"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              20 件処理
            </Button>
            <Button
              onClick={() => runBatch(50)}
              disabled={running || unresolvedActual === 0}
              size="sm"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              最大 (50 件) 処理
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* フィルタ + 集計 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Field label="媒体" className="w-44">
                <Select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                  <option value="">全媒体</option>
                  {channels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="契約状態" className="w-44">
                <Select
                  value={contractFilter}
                  onChange={(e) => setContractFilter(e.target.value as any)}
                >
                  <option value="all">全件</option>
                  <option value="contracted">契約成立のみ</option>
                  <option value="not_contracted">未契約のみ</option>
                </Select>
              </Field>
            </div>
          </div>

          {/* 凡例 */}
          <div className="rounded-xl bg-ink-50/40 px-3 py-2 text-xs flex flex-wrap items-center gap-3">
            <span className="text-ink-500">凡例:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-vivie-400 ring-2 ring-vivie-700" /> 契約済
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-white border-2 border-vivie-400" /> 未契約
            </span>
            <span className="text-ink-300">|</span>
            <span className="text-ink-500">媒体カラー:</span>
            {channelStats.slice(0, 6).map((c) => (
              <span key={c.name} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(c.name) }} />
                <span>{c.name}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 地図 */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          <MapBoard points={filtered} />
        </CardContent>
      </Card>

      {/* 媒体別 (フィルタ後) */}
      <Card>
        <CardHeader>
          <CardTitle>表示中エリア・条件の集計</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>媒体</th>
                <th className="text-right">表示件数</th>
                <th className="text-right">契約</th>
                <th className="text-right">契約率</th>
              </tr>
            </thead>
            <tbody>
              {channelStats.map((c) => (
                <tr key={c.name}>
                  <td className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: colorOf(c.name) }}
                    />
                    {c.name}
                  </td>
                  <td className="text-right">{c.total}</td>
                  <td className="text-right">{c.contracted}</td>
                  <td className="text-right">
                    <Badge tone={c.rate >= 30 ? 'green' : c.rate >= 15 ? 'amber' : 'default'}>
                      {c.rate}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 未試行の住所 */}
      {unresolvedSamples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>未処理の住所 (最大 20 件)</CardTitle>
            <p className="mt-1 text-xs text-ink-500">
              上の「処理」ボタンを押すと自動で解決されます (1 件ずつクリックでも実行可)
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>住所</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>
                {unresolvedSamples.map((u) => (
                  <tr key={u.id}>
                    <td className="text-sm">{u.full_name}</td>
                    <td className="text-xs text-ink-600 truncate max-w-md">{u.address}</td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={retrying === u.id}
                        onClick={() => retryOne(u.id)}
                      >
                        {retrying === u.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        解決
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 失敗した住所 */}
      {failedSamples.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              解決できなかった住所
            </CardTitle>
            <p className="mt-1 text-xs text-ink-500">
              住所が細かすぎる / 表記揺れの可能性。番地以下を削って再試行されます。
              GOOGLE_MAPS_API_KEY を設定すると精度が大幅に上がります。
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>住所</th>
                  <th>エラー</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>
                {failedSamples.map((u) => (
                  <tr key={u.id}>
                    <td className="text-sm">{u.full_name}</td>
                    <td className="text-xs text-ink-600 truncate max-w-sm">{u.address}</td>
                    <td className="text-xs text-amber-700">{u.geo_error}</td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={retrying === u.id}
                        onClick={() => retryOne(u.id)}
                      >
                        {retrying === u.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        再試行
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  const toneClass = {
    default: 'text-ink-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  };
  return (
    <div className="rounded-xl bg-ink-50/40 border border-ink-100 px-3 py-2">
      <p className="text-[10px] text-ink-500">{label}</p>
      <p className={`mt-0.5 font-serif text-xl font-semibold ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}

// 媒体ごとにマーカー色を返す
export function colorOf(channel: string | null | undefined): string {
  const palette: Record<string, string> = {
    minimo: '#DCA9A8',
    HPB: '#F59E0B',
    threads: '#0EA5E9',
    くまポン: '#FACC15',
    Mavie紹介: '#8B5CF6',
    Jicoo: '#10B981',
    Instagram: '#EC4899',
    TikTok: '#1F2937',
    紹介: '#22C55E',
  };
  if (channel && palette[channel]) return palette[channel];
  return '#6B6359';
}
