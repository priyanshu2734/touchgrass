/**
 * Builds links that open an external map service. Providers are replaceable: add an entry to
 * DIRECTIONS_PROVIDERS and it appears in the UI. Nothing is requested until the person clicks the link.
 */
import type { LatLon } from './geo';

export type DirectionsProviderId = 'osm' | 'google' | 'apple';

interface ProviderDef {
  label: string;
  /** What is shared with the provider when the link is opened. */
  shares: string;
  build: (destination: LatLon, origin?: LatLon | null) => string;
}

const point = (p: LatLon) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

export const DIRECTIONS_PROVIDERS: Record<DirectionsProviderId, ProviderDef> = {
  osm: {
    label: 'OpenStreetMap',
    shares: 'the destination and, if you chose one, your search point',
    build: (destination, origin) =>
      origin
        ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${encodeURIComponent(point(origin))}%3B${encodeURIComponent(point(destination))}`
        : `https://www.openstreetmap.org/?mlat=${destination.lat.toFixed(6)}&mlon=${destination.lon.toFixed(6)}#map=17/${destination.lat.toFixed(6)}/${destination.lon.toFixed(6)}`,
  },
  google: {
    label: 'Google Maps',
    shares: 'the destination only (Google may use your own device location)',
    build: (destination) =>
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point(destination))}&travelmode=walking`,
  },
  apple: {
    label: 'Apple Maps',
    shares: 'the destination only (Apple Maps may use your own device location)',
    build: (destination) => `https://maps.apple.com/?daddr=${encodeURIComponent(point(destination))}&dirflg=w`,
  },
};

export const DIRECTIONS_PROVIDER_IDS = Object.keys(DIRECTIONS_PROVIDERS) as DirectionsProviderId[];

export function isDirectionsProvider(value: unknown): value is DirectionsProviderId {
  return typeof value === 'string' && value in DIRECTIONS_PROVIDERS;
}

export function buildDirectionsUrl(provider: DirectionsProviderId, destination: LatLon, origin?: LatLon | null): string {
  return DIRECTIONS_PROVIDERS[provider].build(destination, origin);
}

/** True when the link will be a real route (OpenStreetMap needs a start point to draw one). */
export function givesRoute(provider: DirectionsProviderId, origin?: LatLon | null): boolean {
  return provider !== 'osm' || Boolean(origin);
}
