/** Pure place helpers: distance enrichment, filtering and sorting. Unit tested. */
import type { Place } from '../types';
import { haversineMeters, type LatLon } from './geo';

export type PlaceSort = 'distance' | 'name';

export interface PlaceFilters {
  query: string;
  /** Empty = all categories. */
  categories: string[];
  wheelchairListedOnly: boolean;
  /** Metres. null = no extra limit beyond the search radius. */
  maxDistance: number | null;
}

export const DEFAULT_PLACE_FILTERS: PlaceFilters = { query: '', categories: [], wheelchairListedOnly: false, maxDistance: null };

/**
 * Distances are recomputed on the device from the search point the person chose, because the server only
 * ever saw a rounded copy of it. If there is no search point, the server's value is kept.
 */
export function withDistances(places: Place[], origin: LatLon | null): Place[] {
  if (!origin) return places;
  return places.map((place) => ({ ...place, distanceMeters: Math.round(haversineMeters(origin, place)) }));
}

export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  const query = filters.query.trim().toLowerCase();
  return places.filter((place) => {
    if (query && !`${place.name} ${place.category}`.toLowerCase().includes(query)) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(place.categoryId ?? place.category)) return false;
    if (filters.wheelchairListedOnly && place.wheelchair !== 'yes' && place.wheelchair !== 'limited') return false;
    if (filters.maxDistance !== null && (place.distanceMeters === undefined || place.distanceMeters > filters.maxDistance)) return false;
    return true;
  });
}

export function sortPlaces(places: Place[], sort: PlaceSort): Place[] {
  const copy = [...places];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.name.localeCompare(b.name));
}

export function countByCategory(places: Place[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const place of places) {
    const key = place.categoryId ?? place.category;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
