import { describe, expect, it } from 'vitest';
import { buildDirectionsUrl, givesRoute, isDirectionsProvider } from './directions';

const dest = { lat: 51.5073, lon: -0.1657 };
const origin = { lat: 51.5, lon: -0.12 };

describe('buildDirectionsUrl', () => {
  it('builds an OSM route only when there is an origin', () => {
    const route = new URL(buildDirectionsUrl('osm', dest, origin));
    expect(route.host).toBe('www.openstreetmap.org');
    expect(route.pathname).toBe('/directions');
    expect(route.searchParams.get('route')).toBe('51.500000,-0.120000;51.507300,-0.165700');
    const marker = buildDirectionsUrl('osm', dest, null);
    expect(marker).toContain('mlat=51.507300');
    expect(marker).not.toContain('directions');
  });
  it('google and apple only share the destination', () => {
    const g = new URL(buildDirectionsUrl('google', dest, origin));
    expect(g.searchParams.get('destination')).toBe('51.507300,-0.165700');
    expect(g.search).not.toContain('51.5%2C-0.12');
    expect(buildDirectionsUrl('apple', dest, origin)).toContain('daddr=51.507300%2C-0.165700');
  });
  it('all links are https', () => {
    for (const id of ['osm', 'google', 'apple'] as const) expect(buildDirectionsUrl(id, dest, origin).startsWith('https://')).toBe(true);
  });
  it('knows which providers give a real route', () => {
    expect(givesRoute('osm', null)).toBe(false);
    expect(givesRoute('osm', origin)).toBe(true);
    expect(givesRoute('google', null)).toBe(true);
  });
  it('validates provider ids', () => {
    expect(isDirectionsProvider('osm')).toBe(true);
    expect(isDirectionsProvider('bing')).toBe(false);
    expect(isDirectionsProvider(null)).toBe(false);
  });
});
