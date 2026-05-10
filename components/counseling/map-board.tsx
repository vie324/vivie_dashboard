'use client';
import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { colorOf, type MapPoint } from './counseling-map';
import { formatDate } from '@/lib/utils';

interface Props {
  points: MapPoint[];
}

// 全マーカーが画面に収まるよう自動フィット
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  if (points.length > 0) {
    try {
      const bounds = points.map((p) => [p.geo_lat, p.geo_lng] as [number, number]);
      // @ts-expect-error - LatLngBoundsLike
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch {}
  }
  return null;
}

export function MapBoard({ points }: Props) {
  // 中心 (デフォルトは厚木付近)
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [35.4406, 139.3622];
    const lat = points.reduce((s, p) => s + p.geo_lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.geo_lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: '480px', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {points.map((p) => {
        const color = colorOf(p.acquisition_channel);
        const contracted = !!p.contract_plan;
        return (
          <CircleMarker
            key={p.id}
            center={[p.geo_lat, p.geo_lng]}
            radius={contracted ? 9 : 7}
            pathOptions={{
              color,
              weight: contracted ? 2 : 2.5,
              fillColor: contracted ? color : '#ffffff',
              fillOpacity: contracted ? 0.85 : 0.95,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[180px]">
                <p className="font-bold text-sm">{p.full_name}</p>
                <p>
                  <span className="text-gray-500">媒体:</span>{' '}
                  <span style={{ color }}>{p.acquisition_channel ?? '—'}</span>
                </p>
                <p>
                  <span className="text-gray-500">契約:</span>{' '}
                  {contracted ? (
                    <span style={{ color: '#10B981', fontWeight: 600 }}>{p.contract_plan}</span>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>未契約</span>
                  )}
                </p>
                <p>
                  <span className="text-gray-500">来店日:</span> {formatDate(p.submitted_at)}
                </p>
                {p.address && <p className="text-gray-500 truncate">{p.address}</p>}
                <Link
                  href={`/counseling/${p.id}`}
                  className="inline-block mt-1 text-vivie-700 underline"
                >
                  詳細を開く →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
