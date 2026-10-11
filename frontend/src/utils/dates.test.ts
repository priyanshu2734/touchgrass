import { describe, expect, it } from 'vitest';
import { computeStreaksFromDays, lastDays, localDayKey } from './dates';

describe('computeStreaksFromDays', () => {
  const today = '2026-10-10';
  it('handles no data', () => expect(computeStreaksFromDays([], today)).toEqual({ current: 0, longest: 0 }));
  it('counts a run ending today', () => expect(computeStreaksFromDays(['2026-10-08', '2026-10-09', '2026-10-10'], today)).toEqual({ current: 3, longest: 3 }));
  it('keeps the streak alive until the day ends', () => expect(computeStreaksFromDays(['2026-10-09'], today)).toEqual({ current: 1, longest: 1 }));
  it('ends the current streak after a missed day but keeps the longest', () =>
    expect(computeStreaksFromDays(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-07'], today)).toEqual({ current: 0, longest: 3 }));
  it('ignores duplicates and invalid keys', () => expect(computeStreaksFromDays(['2026-10-10', '2026-10-10', 'nope'], today)).toEqual({ current: 1, longest: 1 }));
});

describe('lastDays', () => {
  it('returns consecutive local days ending today', () => {
    const days = lastDays(3, new Date(2026, 9, 10, 15));
    expect(days).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
    expect(days[2]).toBe(localDayKey(new Date(2026, 9, 10)));
  });
});
