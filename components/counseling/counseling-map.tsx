'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select, Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Loader2, MapPin, Filter, Sparkles } from 'lucide-react';

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

interface Props {
  points: MapPoint[];
  unresolvedCount: number;
}

export function CounselingMapView({ points, unresolvedCount }: Props) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
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

  async function runBatch() {
    if (!confirm('未解決の住所を最大 20 件まで処理します (約 30 秒)。続行しますか?')) return;
    setRunning(true);
    try {
      const res = await fetch('/api/counseling/geocode-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗しました');
      toast.show(
        `処理 ${body.processed} 件 / 解決 ${body.resolved} / 失敗 ${body.failed}`,
        body.resolved > 0 ? 'success' : 'info',
      );
      // ページリロード
      window.location.reload();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
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
            {unresolvedCount > 0 && (
              <Button onClick={runBatch} disabled={running} variant="secondary" size="sm">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                未解決 {unresolvedCount} 件をジオコード
              </Button>
            )}
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
