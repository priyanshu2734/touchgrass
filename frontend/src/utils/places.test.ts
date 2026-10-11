import { describe, expect, it } from 'vitest';
import type { Place } from '../types';
import { DEFAULT_PLACE_FILTERS, countByCategory, filterPlaces, sortPlaces, withDistances } from './places';

const base = { lon: 85.8 };
const places: Place[] = [
  { id: 'a', name: 'Lakeside Park', category: 'Park', categoryId: 'park', lat: 20.31, distanceMeters: 1500, wheelchair: 'yes', ...base },
  { id: 'b', name: 'Botanical Garden', category: 'Garden', categoryId: 'garden', lat: 20.3, distanceMeters: 400, ...base },
  { id: 'c', name: 'Hill View', category: 'Viewpoint', categoryId: 'viewpoint', lat: 20.32, distanceMeters: 3000, wheelchair: 'limited', ...base },
  { id: 'd', name: 'Old Wood', category: 'Woodland', categoryId: 'woodland', lat: 20.33, wheelchair: 'no', ...base },
];

describe('filterPlaces', () => {
  it('returns everything with default filters', () => {
    expect(filterPlaces(places, DEFAULT_PLACE_FILTERS)).toHaveLength(4);
  });
  it('filters by name or category text, case-insensitively', () => {
    expect(filterPlaces(places, { ...DEFAULT_PLACE_FILTERS, query: 'GARDEN' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPlaces(places, { ...DEFAULT_PLACE_FILTERS, query: 'view' }).map((p) => p.id)).toEqual(['c']);
  });
  it('filters by category id', () => {
    expect(filterPlaces(places, { ...DEFAULT_PLACE_FILTERS, categories: ['park', 'garden'] }).map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('wheelchair filter keeps only places that list yes or limited, never guessing for missing data', () => {
    expect(filterPlaces(places, { ...DEFAULT_PLACE_FILTERS, wheelchairListedOnly: true }).map((p) => p.id)).toEqual(['a', 'c']);
  });
  it('max distance excludes places with unknown distance', () => {
    expect(filterPlaces(places, { ...DEFAULT_PLACE_FILTERS, maxDistance: 2000 }).map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('combines filters', () => {
    expect(filterPlaces(places, { ...DEFAULT_PLACE_FILTERS, query: 'park', wheelchairListedOnly: true }).map((p) => p.id)).toEqual(['a']);
  });
});

describe('sortPlaces', () => {
  it('sorts nearest first with unknown distances last, without mutating input', () => {
    const copy = [...places];
    expect(sortPlaces(places, 'distance').map((p) => p.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(places).toEqual(copy);
  });
  it('sorts by name', () => {
    expect(sortPlaces(places, 'name').map((p) => p.name)).toEqual(['Botanical Garden', 'Hill View', 'Lakeside Park', 'Old Wood']);
  });
});

describe('withDistances', () => {
  it('recomputes distance from the chosen origin', () => {
    const [near] = withDistances([{ ...places[0], lat: 20.3, lon: 85.8, distanceMeters: 99999 }], { lat: 20.3, lon: 85.801 });
    expect(near.distanceMeters).toBeGreaterThan(90);
    expect(near.distanceMeters).toBeLessThan(120);
  });
  it('keeps server values when there is no origin', () => {
    expect(withDistances(places, null)).toBe(places);
  });
});

describe('countByCategory', () => {
  it('counts using categoryId, falling back to the label', () => {
    expect(countByCategory([...places, { id: 'e', name: 'X', category: 'Park', lat: 0, lon: 0 }])).toEqual({
      park: 1,
      garden: 1,
      viewpoint: 1,
      woodland: 1,
      Park: 1,
    });
  });
});
