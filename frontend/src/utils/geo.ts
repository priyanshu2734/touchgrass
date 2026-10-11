/** Pure geographic helpers. No I/O, no globals, easy to test. */

const EARTH_RADIUS_M = 6_371_008.8;

export interface LatLon {
  lat: number;
  lon: number;
}

export function isValidLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Straight-line (great-circle) distance in metres. It is NOT a walking distance. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundCoordinate(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** "350 m", "1.2 km", "12 km". Returns null when there is nothing reliable to show. */
export function formatDistance(meters: number | undefined | null): string | null {
  if (meters === undefined || meters === null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Accepts "20.2961, 85.8245" or "20.2961 85.8245" (also with a degree sign or semicolon).
 * Returns null for anything else, so typed place names go to the geocoder instead.
 */
export function parseCoordinates(input: string): LatLon | null {
  const match = input.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*°?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return isValidLatLon(lat, lon) ? { lat, lon } : null;
}

export function formatCoordinates(point: LatLon, decimals = 4): string {
  return `${point.lat.toFixed(decimals)}, ${point.lon.toFixed(decimals)}`;
}
