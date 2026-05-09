'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Select, Field } from '@/components/ui/input';
import { MapPin, LogIn, LogOut, Coffee, Play, AlertTriangle } from 'lucide-react';
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
  store?: { name: string } | null;
}

interface Props {
  token: string;
  staffId: string;
  staffName: string;
  primaryStoreId: string | null;
  stores: StoreOpt[];
  logs: LogRow[];
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

export function StaffAttendancePanel({
  token,
  staffName,
  primaryStoreId,
  stores,
  logs: initialLogs,
}: Props) {
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
      (err) => setGeoError(err.message || '位置情報を取得できませんでした'),
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
  const storeNotConfigured = store && (store.latitude == null || store.longitude == null);

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
      const res = await fetch(`/api/staff/attendance/${token}`, {
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
      toast.show(`${kindLabel[kind]}しました (${staffName})`, 'success');
      setLogs((list) => [body.log, ...list].slice(0, 20));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '打刻に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
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
                    店舗の座標が未設定です。管理者にお問い合わせください。
                  </p>
                ) : geoError ? (
                  <p className="text-sm text-red-700">{geoError}</p>
                ) : !coords ? (
                  <p className="text-sm text-ink-500">位置情報を取得中…</p>
                ) : (
                  <>
                    <p className="text-sm text-ink-900">
                      店舗まで <strong>{distance}m</strong>
                      <span className="ml-2 text-xs text-ink-500">
                        (許容 {radius}m / 精度 ±{Math.round(coords.accuracy)}m)
                      </span>
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

          <div className="grid grid-cols-2 gap-2">
            <ClockBtn kind="clock_in" disabled={!inRange || submitting} onClick={() => clock('clock_in')} />
            <ClockBtn kind="break_start" disabled={!inRange || submitting} onClick={() => clock('break_start')} />
            <ClockBtn kind="break_end" disabled={!inRange || submitting} onClick={() => clock('break_end')} />
            <ClockBtn kind="clock_out" disabled={!inRange || submitting} onClick={() => clock('clock_out')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>あなたの打刻履歴</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState icon={<MapPin size={28} />} title="まだ打刻履歴がありません" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {logs.map((log) => {
                const Icon = kindIcon[log.kind];
                return (
                  <li key={log.id} className="px-4 py-3 flex items-center gap-3">
                    <Icon size={16} className="text-vivie-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{kindLabel[log.kind]}</p>
                      <p className="text-xs text-ink-400">
                        {formatDateTime(log.clocked_at)} ・ {log.store?.name ?? '—'}
                      </p>
                    </div>
                    <span className="text-xs text-ink-400">{Math.round(log.distance_meters)}m</span>
                  </li>
                );
              })}
            </ul>
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
      className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tone[kind]}`}
    >
      <Icon size={20} />
      {kindLabel[kind]}
    </button>
  );
}
