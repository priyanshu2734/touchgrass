import { describe, expect, it } from 'vitest';
import { formatDistance, haversineMeters, isValidLatLon, parseCoordinates, roundCoordinate } from './geo';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lat: 20.29, lon: 85.82 }, { lat: 20.29, lon: 85.82 })).toBeCloseTo(0, 6);
  });
  it('matches a known distance (London to Paris is about 343.5 km)', () => {
    const d = haversineMeters({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 });
    expect(d / 1000).toBeGreaterThan(340);
    expect(d / 1000).toBeLessThan(347);
  });
  it('one degree of latitude is about 111.2 km', () => {
    expect(haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -2);
  });
  it('is symmetric and handles the antimeridian', () => {
    const a = { lat: 10, lon: 20 };
    const b = { lat: -30, lon: 140 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
    expect(haversineMeters({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 })).toBeLessThan(25_000);
  });
});

describe('isValidLatLon', () => {
  it.each([
    [0, 0, true],
    [90, 180, true],
    [-90.0001, 0, false],
    [0, 180.5, false],
    [NaN, 0, false],
    [Infinity, 0, false],
  ])('(%s, %s) -> %s', (lat, lon, expected) => {
    expect(isValidLatLon(lat, lon)).toBe(expected);
  });
  it('rejects non-numbers', () => {
    expect(isValidLatLon('1', 2)).toBe(false);
    expect(isValidLatLon(null, undefined)).toBe(false);
  });
});

describe('formatDistance', () => {
  it('formats metres and kilometres', () => {
    expect(formatDistance(8)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(12_400)).toBe('12 km');
  });
  it('returns null when there is nothing reliable to show', () => {
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(NaN)).toBeNull();
    expect(formatDistance(-5)).toBeNull();
  });
});

describe('parseCoordinates', () => {
  it('parses common formats', () => {
    expect(parseCoordinates('20.2961, 85.8245')).toEqual({ lat: 20.2961, lon: 85.8245 });
    expect(parseCoordinates('  -33.86 151.21 ')).toEqual({ lat: -33.86, lon: 151.21 });
    expect(parseCoordinates('51.5°; -0.12°')).toEqual({ lat: 51.5, lon: -0.12 });
  });
  it('rejects place names and out-of-range values', () => {
    expect(parseCoordinates('Bhubaneswar')).toBeNull();
    expect(parseCoordinates('95, 10')).toBeNull();
    expect(parseCoordinates('10, 200')).toBeNull();
    expect(parseCoordinates('221B Baker Street')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
  });
});

describe('roundCoordinate', () => {
  it('rounds to ~110 m by default', () => {
    expect(roundCoordinate(20.296123)).toBe(20.296);
    expect(roundCoordinate(85.8249, 2)).toBe(85.82);
  });
});
