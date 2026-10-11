import { beforeEach, describe, expect, it } from 'vitest';
import {
  DUPLICATE_WINDOW_MS,
  buildProgress,
  cancelStart,
  clearAll,
  readEntries,
  readStarts,
  recordCompletion,
  recordSession,
  removeEntry,
  startQuest,
  updateNote,
} from './store';

const quest = { id: 'cloud-spotter', title: 'Cloud spotter', category: 'nature-observation' as const, minutes: 10 };
const other = { id: 'listen-map', title: 'Sound map', category: 'nature-observation' as const, minutes: 15 };
const t = (iso: string) => new Date(iso);

beforeEach(() => {
  window.localStorage.clear();
});

describe('quest completion', () => {
  it('starts empty: no fake achievements or history', () => {
    const p = buildProgress(readEntries(), '2026-10-10');
    expect(p).toMatchObject({ completedActivities: 0, outdoorMinutes: 0, currentStreak: 0, longestStreak: 0, recent: [], activeDays: 0 });
    expect(p.milestones.every((m) => !m.achieved && m.current === 0)).toBe(true);
  });

  it('records a completion with the minutes and note the person entered', () => {
    expect(recordCompletion(quest, { minutesSpent: 17, reflection: '  Fast clouds  ' }, t('2026-10-10T09:00:00Z'))).toBe(true);
    const [entry] = readEntries();
    expect(entry).toMatchObject({ kind: 'quest', questId: 'cloud-spotter', minutes: 17, note: 'Fast clouds' });
    expect(buildProgress(readEntries(), entry.localDate).outdoorMinutes).toBe(17);
  });

  it('defaults to the quest duration', () => {
    recordCompletion(quest, {}, t('2026-10-10T09:00:00Z'));
    expect(readEntries()[0].minutes).toBe(10);
  });

  it('is idempotent unless repeat is set', () => {
    recordCompletion(quest, {}, t('2026-10-10T09:00:00Z'));
    expect(recordCompletion(quest, {}, t('2026-10-10T12:00:00Z'))).toBe(false);
    expect(readEntries()).toHaveLength(1);
  });

  it('allows repeats but ignores an accidental double submit', () => {
    recordCompletion(quest, {}, t('2026-10-10T09:00:00Z'));
    expect(recordCompletion(quest, { repeat: true }, new Date(t('2026-10-10T09:00:00Z').getTime() + DUPLICATE_WINDOW_MS - 1000))).toBe(false);
    expect(recordCompletion(quest, { repeat: true }, t('2026-10-10T10:00:00Z'))).toBe(true);
    expect(readEntries()).toHaveLength(2);
  });

  it('rejects invalid minutes', () => {
    for (const minutesSpent of [0, -5, 601, 2.5, NaN]) {
      expect(() => recordCompletion(quest, { minutesSpent })).toThrow(/between 1 and 600/);
    }
    expect(readEntries()).toHaveLength(0);
  });

  it('clears the started state when completed', () => {
    startQuest(quest.id);
    expect(readStarts()[quest.id]).toBeDefined();
    recordCompletion(quest, {}, t('2026-10-10T09:00:00Z'));
    expect(readStarts()[quest.id]).toBeUndefined();
  });
});

describe('start and cancel', () => {
  it('start is idempotent and cancel removes it', () => {
    startQuest(quest.id, t('2026-10-10T09:00:00Z'));
    startQuest(quest.id, t('2026-10-10T10:00:00Z'));
    expect(readStarts()[quest.id]).toBe('2026-10-10T09:00:00.000Z');
    cancelStart(quest.id);
    expect(readStarts()).toEqual({});
  });
});

describe('progress from real dates', () => {
  it('computes streaks from the local dates entered', () => {
    recordCompletion(quest, { localDate: '2026-10-08' }, t('2026-10-08T09:00:00Z'));
    recordCompletion(other, { localDate: '2026-10-09' }, t('2026-10-09T09:00:00Z'));
    recordSession({ minutes: 20, localDate: '2026-10-10' }, t('2026-10-10T09:00:00Z'));
    const p = buildProgress(readEntries(), '2026-10-10');
    expect(p).toMatchObject({ currentStreak: 3, longestStreak: 3, activeDays: 3, sessionsLogged: 1, completedActivities: 2, outdoorMinutes: 45 });
    expect(p.milestones.find((m) => m.id === 'streak-3')?.achieved).toBe(true);
    expect(p.activeDates).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
  });

  it('the streak survives until the day ends and then resets, keeping the longest', () => {
    recordCompletion(quest, { localDate: '2026-10-09' }, t('2026-10-09T09:00:00Z'));
    expect(buildProgress(readEntries(), '2026-10-10').currentStreak).toBe(1);
    expect(buildProgress(readEntries(), '2026-10-11')).toMatchObject({ currentStreak: 0, longestStreak: 1 });
  });

  it('counts category variety and reflections for milestones', () => {
    recordCompletion(quest, { reflection: 'hi' }, t('2026-10-10T09:00:00Z'));
    const p = buildProgress(readEntries(), '2026-10-10');
    expect(p.milestones.find((m) => m.id === 'first-reflection')?.achieved).toBe(true);
    expect(p.milestones.find((m) => m.id === 'variety-3')?.current).toBe(1);
  });
});

describe('notes and removal', () => {
  it('edits and removes entries; unknown ids are an error', () => {
    recordSession({ minutes: 10 }, t('2026-10-10T09:00:00Z'));
    const { id } = readEntries()[0];
    updateNote(id, ' Sunny ');
    expect(readEntries()[0].note).toBe('Sunny');
    updateNote(id, '   ');
    expect(readEntries()[0].note).toBeUndefined();
    removeEntry(id);
    expect(readEntries()).toEqual([]);
    expect(() => removeEntry(id)).toThrow(/could not be found/);
    expect(() => updateNote('missing', 'x')).toThrow(/could not be found/);
  });

  it('strips control characters from notes', () => {
    recordSession({ minutes: 5, note: 'a\u0000b\u0007c' }, t('2026-10-10T09:00:00Z'));
    expect(readEntries()[0].note).toBe('abc');
  });
});

describe('storage', () => {
  it('migrates Part 1 demo completions once', () => {
    window.localStorage.setItem(
      'touchgrass.demo.completions.v1',
      JSON.stringify([{ questId: 'cloud-spotter', title: 'Cloud spotter', completedAt: '2026-10-09T08:00:00.000Z', minutes: 10 }, { junk: true }]),
    );
    const entries = readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'quest', questId: 'cloud-spotter', minutes: 10 });
    expect(readEntries()).toHaveLength(1);
  });

  it('ignores corrupted storage', () => {
    window.localStorage.setItem('touchgrass.demo.entries.v2', '{not json');
    expect(readEntries()).toEqual([]);
  });

  it('clearAll wipes entries and starts', () => {
    recordSession({ minutes: 5 });
    startQuest('x');
    clearAll();
    expect(readEntries()).toEqual([]);
    expect(readStarts()).toEqual({});
  });
});
