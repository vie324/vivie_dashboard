'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Select, Field } from '@/components/ui/input';
import { MapPin, Loader2, LogIn, LogOut, Coffee, Play, AlertTriangle } from 'lucide-react';
import { haversineMeters } from '@/lib/geo';
import { formatDateTime } from '@/lib/utils';
import type { AttendanceKind } from '@/types/database';

interface StoreOpt {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
}

interface LogRow {
  id: string;
  kind: AttendanceKind;
  clocked_at: string;
  distance_meters: number;
  staff?: { display_name: string } | null;
  store?: { name: string } | null;
}

interface Props {
  staffId: string;
  staffName: string;
  primaryStoreId: string | null;
  stores: StoreOpt[];
  logs: LogRow[];
  isManager: boolean;
}

const kindLabel: Record<AttendanceKind, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const kindIcon: Record<AttendanceKind, React.ComponentType<any>> = {
  clock_in: LogIn,
  clock_out: LogOut,
  break_start: Coffee,
  break_end: Play,
};

export function AttendancePanel({
  staffId,
  staffName,
  primaryStoreId,
  stores,
  logs: initialLogs,
  isManager,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [storeId, setStoreId] = useState(primaryStoreId ?? stores[0]?.id ?? '');
  const [coords, setCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState(initialLogs);

  const store = stores.find((s) => s.id === storeId);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('このブラウザは位置情報に対応していません');
      return;
    }
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGeoError(null);
      },
      (err) => {
        setGeoError(err.message || '位置情報を取得できませんでした');
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const distance =
    coords && store?.latitude != null && store?.longitude != null
      ? Math.round(haversineMeters(coords.lat, coords.lon, store.latitude, store.longitude))
      : null;
  const radius = store?.radius_meters ?? 300;
  const inRange = distance != null && distance <= radius;

  async function clock(kind: AttendanceKind) {
    if (!coords) {
      toast.show('位置情報を取得中です', 'error');
      return;
    }
    if (!store) {
      toast.show('店舗を選択してください', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          store_id: store.id,
          kind,
          latitude: coords.lat,
          longitude: coords.lon,
          accuracy: coords.accuracy,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? '打刻に失敗しました');
      toast.show(`${kindLabel[kind]}しました`, 'success');
      setLogs((list) => [body.log, ...list].slice(0, 80));
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '打刻に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const storeNotConfigured = store && (store.latitude == null || store.longitude == null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>打刻 - {staffName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="店舗" required>
              <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    geoError
                      ? 'bg-red-100 text-red-600'
                      : inRange
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {geoError ? <AlertTriangle size={18} /> : <MapPin size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  {storeNotConfigured ? (
                    <p className="text-sm text-amber-700">
                      この店舗の座標が未設定です。設定 &gt; 店舗から登録してください。
                    </p>
                  ) : geoError ? (
                    <p className="text-sm text-red-700">{geoError}</p>
                  ) : !coords ? (
                    <p className="text-sm text-ink-500">位置情報を取得中…</p>
                  ) : (
                    <>
                      <p className="text-sm text-ink-900">
                        店舗まで <strong>{distance}m</strong>
                        <span className="ml-2 text-xs text-ink-500">(許容 {radius}m / 精度 ±{Math.round(coords.accuracy)}m)</span>
                      </p>
                      <div className="mt-1.5">
                        {inRange ? (
                          <Badge tone="green">圏内・打刻できます</Badge>
                        ) : (
                          <Badge tone="amber">圏外・店舗に近づいてください</Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ClockBtn kind="clock_in" disabled={!inRange || submitting} onClick={() => clock('clock_in')} />
              <ClockBtn kind="break_start" disabled={!inRange || submitting} onClick={() => clock('break_start')} />
              <ClockBtn kind="break_end" disabled={!inRange || submitting} onClick={() => clock('break_end')} />
              <ClockBtn kind="clock_out" disabled={!inRange || submitting} onClick={() => clock('clock_out')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>あなたの今月</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <MyStats logs={initialLogs} staffId={staffId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isManager ? '全員の打刻履歴' : 'あなたの打刻履歴'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState icon={<MapPin size={28} />} title="まだ打刻履歴がありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>区分</th>
                    {isManager && <th>スタッフ</th>}
                    <th>店舗</th>
                    <th className="text-right">店舗まで</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const Icon = kindIcon[log.kind];
                    return (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(log.clocked_at)}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Icon size={14} className="text-vivie-500" />
                            {kindLabel[log.kind]}
                          </span>
                        </td>
                        {isManager && <td className="text-sm">{log.staff?.display_name ?? '—'}</td>}
                        <td className="text-xs text-ink-600">{log.store?.name ?? '—'}</td>
                        <td className="text-right text-xs text-ink-500">{Math.round(log.distance_meters)}m</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClockBtn({
  kind,
  disabled,
  onClick,
}: {
  kind: AttendanceKind;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = kindIcon[kind];
  const tone: Record<AttendanceKind, string> = {
    clock_in: 'bg-vivie-400 hover:bg-vivie-500 text-white',
    clock_out: 'bg-ink-700 hover:bg-ink-900 text-white',
    break_start: 'bg-amber-400 hover:bg-amber-500 text-white',
    break_end: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tone[kind]}`}
    >
      <Icon size={18} />
      {kindLabel[kind]}
    </button>
  );
}

function MyStats({ logs, staffId }: { logs: LogRow[]; staffId: string }) {
  const myLogs = logs.filter((l) => (l as any).staff_id === staffId || true); // 自分の日報用 (フィルタ済)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const myMonth = myLogs.filter((l) => new Date(l.clocked_at) >= monthStart);
  const inDays = new Set(
    myMonth.filter((l) => l.kind === 'clock_in').map((l) => l.clocked_at.slice(0, 10)),
  );

  return (
    <>
      <Stat label="今月の出勤日数" value={`${inDays.size} 日`} />
      <Stat label="今月の打刻数" value={`${myMonth.length} 回`} />
      <Stat
        label="最後の打刻"
        value={myMonth[0] ? `${kindLabel[myMonth[0].kind]} ${formatDateTime(myMonth[0].clocked_at)}` : '—'}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/50 px-3 py-2.5">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-sm font-medium text-ink-900 text-right">{value}</span>
    </div>
  );
}
