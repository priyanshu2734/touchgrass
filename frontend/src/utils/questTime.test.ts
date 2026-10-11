import { describe, expect, it } from 'vitest';
import { minutesAgo, suggestMinutes } from './questTime';

const now = new Date('2026-10-10T10:00:00Z');

describe('suggestMinutes', () => {
  it('uses elapsed time since start when plausible', () => {
    expect(suggestMinutes({ minutes: 20, startedAt: '2026-10-10T09:35:00Z' }, now)).toEqual({ minutes: 25, fromStart: true });
  });
  it('falls back to the quest duration when not started, too short, or stale', () => {
    expect(suggestMinutes({ minutes: 20 }, now)).toEqual({ minutes: 20, fromStart: false });
    expect(suggestMinutes({ minutes: 20, startedAt: '2026-10-10T09:59:50Z' }, now).fromStart).toBe(false);
    expect(suggestMinutes({ minutes: 20, startedAt: '2026-10-08T09:00:00Z' }, now).fromStart).toBe(false);
    expect(suggestMinutes({ minutes: 20, startedAt: 'garbage' }, now).fromStart).toBe(false);
  });
});

describe('minutesAgo', () => {
  it('handles missing and future values', () => {
    expect(minutesAgo(undefined, now)).toBeNull();
    expect(minutesAgo('2026-10-10T09:50:00Z', now)).toBe(10);
    expect(minutesAgo('2026-10-10T11:00:00Z', now)).toBeNull();
  });
});
