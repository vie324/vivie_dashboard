// 地球の半径 (メートル)
const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine による 2 点間距離 (メートル)
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export function isWithinRadius(
  current: Coords,
  store: Coords & { radius_meters: number },
): { ok: boolean; distance: number } {
  const distance = haversineMeters(
    current.latitude,
    current.longitude,
    store.latitude,
    store.longitude,
  );
  return { ok: distance <= store.radius_meters, distance };
}
