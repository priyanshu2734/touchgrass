import { describe, expect, it } from 'vitest';
import { MOCK_QUESTS } from '../data/quests';
import type { Quest } from '../types';
import { buildConstraints, dropConstraint, matchQuests, passesHardLimits } from './questMatching';

const quests: Quest[] = MOCK_QUESTS.map((q) => ({ ...q, status: 'available' as const }));
const ids = (barriers: Parameters<typeof buildConstraints>[0], prefs?: Parameters<typeof buildConstraints>[1]) =>
  matchQuests(quests, buildConstraints(barriers, prefs), 100).matches.map((m) => m.quest.id);

describe('hard limits', () => {
  it('short-time keeps only quests of 20 minutes or less', () => {
    const result = matchQuests(quests, buildConstraints(['short-time']), 100).matches;
    expect(result.length).toBeGreaterThan(5);
    expect(result.every((m) => m.quest.minutes <= 20)).toBe(true);
  });
  it('no-budget keeps only free quests, and unknown budget is not assumed free', () => {
    expect(matchQuests(quests, buildConstraints(['no-budget']), 100).matches.every((m) => m.quest.budget === 'free')).toBe(true);
    const unknown: Quest = { ...quests[0], budget: undefined };
    expect(passesHardLimits(unknown, buildConstraints(['no-budget']))).toBe(false);
  });
  it('low-energy keeps only low-energy quests', () => {
    expect(matchQuests(quests, buildConstraints(['low-energy']), 100).matches.every((m) => m.quest.energy === 'low')).toBe(true);
  });
  it('solo excludes group-only quests', () => {
    const list = ids(['solo']);
    expect(list).not.toContain('walk-and-talk');
    expect(list).not.toContain('shared-picnic');
    expect(list).toContain('cloud-spotter');
  });
  it('accessible requires the step-free tag and low energy', () => {
    const matches = matchQuests(quests, buildConstraints(['accessible']), 100).matches;
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m.quest.accessibility).toContain('step-free');
      expect(m.quest.energy).toBe('low');
      expect(m.caveats.join(' ')).toMatch(/Check the actual route/);
    }
  });
  it('quiet requires the low-sensory tag', () => {
    expect(matchQuests(quests, buildConstraints(['quiet']), 100).matches.every((m) => m.quest.accessibility?.includes('low-sensory'))).toBe(true);
  });
  it('near-home excludes quests that need a trip', () => {
    const list = ids(['near-home']);
    expect(list).not.toContain('two-stops-farther');
    expect(list).toContain('five-minutes-at-the-door');
  });
  it('quests missing accessibility data never satisfy an accessibility need', () => {
    const bare: Quest = { ...quests[0], accessibility: undefined };
    expect(passesHardLimits(bare, buildConstraints([], { accessibility: ['seating'] }))).toBe(false);
  });
});

describe('combinations the product promises to support', () => {
  it('10 to 20 minutes, free, low energy, solo, close to home still has real options', () => {
    const list = ids(['short-time', 'no-budget', 'low-energy', 'solo', 'near-home']);
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list).toContain('five-minutes-at-the-door');
  });
  it('every barrier on its own returns options', () => {
    for (const b of ['short-time', 'no-budget', 'low-energy', 'solo', 'accessible', 'near-home', 'bad-weather', 'quiet'] as const) {
      expect(ids([b]).length, b).toBeGreaterThan(0);
    }
  });
});

describe('weather', () => {
  it('ranks weather-proof quests first and flags the indoor fallback on the rest', () => {
    const { matches } = matchQuests(quests, buildConstraints(['bad-weather']), 100);
    const firstSensitive = matches.findIndex((m) => m.quest.weatherSensitive);
    const lastProof = matches.map((m) => m.quest.weatherSensitive).lastIndexOf(false);
    expect(lastProof).toBeLessThan(firstSensitive);
    const sensitive = matches.find((m) => m.quest.weatherSensitive)!;
    expect(sensitive.suggestFallback).toBe(true);
    expect(sensitive.quest.indoorFallback).toBeDefined();
  });
  it('does not exclude weather-sensitive quests', () => {
    expect(ids(['bad-weather']).length).toBe(quests.length);
  });
});

describe('interests, preferences and status', () => {
  it('interests raise matching quests and explain why', () => {
    const { matches } = matchQuests(quests, buildConstraints([], { interests: ['gardening'] }), 100);
    expect(matches[0].quest.interests).toContain('gardening');
    expect(matches[0].reasons.join(' ')).toMatch(/interest in gardening/);
  });
  it('builds constraints from planner preferences (120 means no time cap, flexible means no budget cap)', () => {
    const c = buildConstraints([], { minutes: 120, budget: 'flexible', energy: 'high', company: 'friends', accessibility: ['seating'] });
    expect(c.maxMinutes).toBeUndefined();
    expect(c.maxBudget).toBeUndefined();
    expect(c.maxEnergy).toBeUndefined();
    expect(c.requireSolo).toBe(false);
    expect(c.preferredCompany).toBe('friends');
    expect(c.accessibility).toEqual(['seating']);
  });
  it('short-time never raises a smaller time limit', () => {
    expect(buildConstraints(['short-time'], { minutes: 10 }).maxMinutes).toBe(10);
    expect(buildConstraints(['short-time'], { minutes: 60 }).maxMinutes).toBe(20);
  });
  it('in-progress quests float up and completed ones sink', () => {
    const list = quests.map((q) => (q.id === 'cloud-spotter' ? { ...q, status: 'in-progress' as const } : q.id === 'ten-minute-loop' ? { ...q, status: 'completed' as const } : q));
    const { matches } = matchQuests(list, buildConstraints(['short-time']), 100);
    expect(matches[0].quest.id).toBe('cloud-spotter');
    expect(matches[0].reasons[0]).toBe('You already started this one');
    expect(matches.findIndex((m) => m.quest.id === 'ten-minute-loop')).toBeGreaterThan(2);
  });
});

describe('when nothing fits', () => {
  // The real catalogue has a 5-minute quest that fits almost everything, so remove it to create a genuine gap.
  const gap = quests.filter((q) => q.id !== 'five-minutes-at-the-door');
  const impossible = buildConstraints(['no-budget', 'low-energy', 'solo', 'accessible'], { minutes: 5 as never });
  it('returns no matches and does not silently relax anything', () => {
    const result = matchQuests(gap, impossible);
    expect(result.matches).toEqual([]);
    expect(result.total).toBe(0);
  });
  it('the full catalogue does have a quest that fits even this stack of limits', () => {
    expect(matchQuests(quests, impossible).matches.map((m) => m.quest.id)).toEqual(['five-minutes-at-the-door']);
  });
  it('offers single limits to drop, with counts and the barriers they map to', () => {
    const { relaxations } = matchQuests(gap, impossible);
    expect(relaxations.length).toBeGreaterThan(0);
    expect(relaxations.every((r) => r.count > 0 && r.barriers.length > 0)).toBe(true);
    expect(relaxations[0].count).toBeGreaterThanOrEqual(relaxations[relaxations.length - 1].count);
    const key = relaxations[0].key;
    expect(matchQuests(gap, dropConstraint(impossible, key), 100).total).toBe(relaxations[0].count);
  });
});
