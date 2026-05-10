// 住所 → 緯度経度 のジオコーディング
// 既定では Nominatim (OpenStreetMap, 無料)。Google Maps API キーがあれば優先。

export interface GeocodeResult {
  lat: number;
  lng: number;
  source: 'nominatim' | 'google';
  formatted_address?: string;
  used_address?: string; // 実際にヒットしたクエリ (簡略化されている場合あり)
}

const NOMINATIM_USER_AGENT = 'vivie-dashboard/1.0 (contact: admin)';

// 日本の住所表記揺れを軽く正規化
function normalizeJaAddress(addr: string): string {
  return addr
    .replace(/[〒]\s?\d{3}-?\d{4}/g, '') // 〒012-3456
    .replace(/^\d{3}-?\d{4}\s*/g, '')      // 先頭の郵便番号 (例: 2570001)
    .replace(/　/g, ' ')                  // 全角空白
    .replace(/\s+/g, ' ')
    .trim();
}

// 番地以下を段階的に削って簡略化
// 「神奈川県厚木市妻田北3-13-16」 → 「神奈川県厚木市妻田北3」 → 「神奈川県厚木市妻田北」 → 「神奈川県厚木市」
export function simplifyAddress(addr: string): string[] {
  const norm = normalizeJaAddress(addr);
  const variants: string[] = [norm];

  // 1) 末尾の番地・建物名を削る (「3-13-16」「メゾン202」「101号室」等)
  const noBuilding = norm
    .replace(/\s*[ァ-ー\w-]+(マンション|ハウス|コーポ|ハイム|レジデンス|タウン|ビル|ハイツ|アパート|テラス|レジ|レゾン|アヴェニール|レックス|フェリックス|サニー|プレミスト|レジェーラ|サンモール|サンハイツ|シャルマン|アパ|エクセレント|プレドル|スウィート|プチ|アルファ|サウス|ノース|イースト|ウェスト|スカイ|グリーン|ローズ|ロゼ|プチ)[^\s]*/g, '')
    .replace(/\s*\d+号室?$/g, '')
    .replace(/\s*[A-Za-z0-9-]+号$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (noBuilding && noBuilding !== norm) variants.push(noBuilding);

  // 2) 番地レベルを削る (xxx の後の数字-数字-数字)
  const noStreetNum = noBuilding.replace(/\s*\d+(-\d+)+.*$/, '').trim();
  if (noStreetNum && noStreetNum !== noBuilding) variants.push(noStreetNum);

  // 3) 「丁目」までで止める
  const cityCho = noStreetNum.match(/^(.+?[市区町村].+?(丁目|町|大字|字).*?)(?=\s|\d|$)/);
  if (cityCho) {
    const v = cityCho[1].trim();
    if (v && !variants.includes(v)) variants.push(v);
  }

  // 4) 市区町村レベル
  const cityMatch = noStreetNum.match(/^(.+?[市区町村])/);
  if (cityMatch) {
    const v = cityMatch[1].trim();
    if (v && !variants.includes(v)) variants.push(v);
  }

  // 5) 都道府県レベル
  const prefMatch = norm.match(/^(.+?[都道府県])/);
  if (prefMatch) {
    const v = prefMatch[1].trim();
    if (v && !variants.includes(v)) variants.push(v);
  }

  return Array.from(new Set(variants)).filter(Boolean);
}

async function googleGeocode(query: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query,
    )}&language=ja&region=jp&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]) {
      const r = data.results[0];
      return {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        source: 'google',
        formatted_address: r.formatted_address,
        used_address: query,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function nominatimGeocode(query: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&accept-language=ja&countrycodes=jp&limit=1&q=${encodeURIComponent(
      query,
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
      used_address: query,
    };
  } catch {
    return null;
  }
}

// 段階的に簡略化しながらヒットするまで試す
export async function geocode(address: string): Promise<GeocodeResult | null> {
  if (!address) return null;
  const variants = simplifyAddress(address);
  const useGoogle = !!process.env.GOOGLE_MAPS_API_KEY;

  for (const q of variants) {
    if (useGoogle) {
      const r = await googleGeocode(q);
      if (r) return r;
    } else {
      const r = await nominatimGeocode(q);
      if (r) return r;
      // Nominatim はレート制限があるので簡略化候補ごとに 1 秒待機
      await new Promise((res) => setTimeout(res, 1100));
    }
  }
  return null;
}
