// 住所 → 緯度経度 のジオコーディング
// 既定では Nominatim (OpenStreetMap, 無料)。Google Maps API キーがあれば優先。

export interface GeocodeResult {
  lat: number;
  lng: number;
  source: 'nominatim' | 'google';
  formatted_address?: string;
}

const NOMINATIM_USER_AGENT = 'vivie-dashboard/1.0 (contact: admin)';

// 日本の住所表記揺れを軽く正規化
function normalizeJaAddress(addr: string): string {
  return addr
    .replace(/[〒]\s?\d{3}-?\d{4}/g, '')           // 郵便番号
    .replace(/　/g, ' ')                        // 全角空白
    .replace(/\s+/g, ' ')
    .trim();
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const normalized = normalizeJaAddress(address);
  if (!normalized) return null;

  // Google Maps API キーがあれば使用
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        normalized,
      )}&language=ja&region=jp&key=${googleKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const r = data.results[0];
        return {
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          source: 'google',
          formatted_address: r.formatted_address,
        };
      }
      if (data.status === 'ZERO_RESULTS') return null;
      // OVER_QUERY_LIMIT などは Nominatim にフォールバック
    } catch {
      // フォールバック
    }
  }

  // Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&accept-language=ja&countrycodes=jp&limit=1&q=${encodeURIComponent(
      normalized,
    )}`;
    const res = await fetch(url, {
      headers: { 'user-agent': NOMINATIM_USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      source: 'nominatim',
      formatted_address: data[0].display_name,
    };
  } catch {
    return null;
  }
}
