/**
 * MOCK STORE. Keeps entries in this browser's localStorage so the progress page shows real (locally recorded)
 * activity in demo mode. Nothing is sent anywhere. The rules mirror the backend (backend/part3/quest_service.py).
 */
import type { CompleteQuestInput, Milestone, Progress, QuestCategory, SessionInput } from '../../types';
import { computeStreaksFromDays, localDayKey } from '../../utils/dates';

const KEY = 'touchgrass.demo.entries.v2';
const LEGACY_KEY = 'touchgrass.demo.completions.v1';
const STARTS_KEY = 'touchgrass.demo.starts.v1';
export const DUPLICATE_WINDOW_MS = 30_000;
const MAX_RECENT = 30;

export interface StoredEntry {
  id: string;
  kind: 'quest' | 'session';
  questId?: string;
  title: string;
  category?: QuestCategory;
  minutes: number;
  note?: string;
  completedAt: string;
  localDate: string;
}

function isEntry(value: unknown): value is StoredEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    (v.kind === 'quest' || v.kind === 'session') &&
    typeof v.title === 'string' &&
    typeof v.minutes === 'number' &&
    typeof v.completedAt === 'string' &&
    typeof v.localDate === 'string'
  );
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('Could not save to this browser. Storage may be disabled or full.');
  }
}

let counter = 0;
const newId = (): string => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export function readEntries(): StoredEntry[] {
  const current = readJson(KEY);
  if (Array.isArray(current)) return current.filter(isEntry);

  // One-time migration of Part 1 demo completions (they were real actions, so keep them).
  const legacy = readJson(LEGACY_KEY);
  if (Array.isArray(legacy)) {
    const migrated: StoredEntry[] = [];
    for (const item of legacy) {
      const v = item as Record<string, unknown>;
      if (typeof v?.questId === 'string' && typeof v.title === 'string' && typeof v.completedAt === 'string' && typeof v.minutes === 'number') {
        migrated.push({
          id: newId(),
          kind: 'quest',
          questId: v.questId,
          title: v.title,
          minutes: v.minutes,
          completedAt: v.completedAt,
          localDate: localDayKey(new Date(v.completedAt)),
        });
      }
    }
    if (migrated.length > 0) write(KEY, migrated);
    return migrated;
  }
  return [];
}

export function cleanNote(value: string | undefined | null): string | undefined {
  // eslint-disable-next-line no-control-regex
  const text = (value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  return text ? text.slice(0, 500) : undefined;
}

function validMinutes(minutes: number): number {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new Error('Enter a whole number of minutes between 1 and 600.');
  return minutes;
}

export interface QuestRef {
  id: string;
  title: string;
  category: QuestCategory;
  minutes: number;
}

/**
 * Idempotent like the real backend: completing a completed quest does nothing unless `repeat` is set,
 * and a repeat within 30 seconds of the last one is ignored as an accidental double tap.
 */
export function recordCompletion(quest: QuestRef, input: CompleteQuestInput = {}, now: Date = new Date()): boolean {
  const minutes = validMinutes(input.minutesSpent ?? quest.minutes);
  const entries = readEntries();
  const last = entries
    .filter((e) => e.kind === 'quest' && e.questId === quest.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];

  let record = true;
  if (last) {
    if (!input.repeat) record = false;
    else if (now.getTime() - new Date(last.completedAt).getTime() < DUPLICATE_WINDOW_MS) record = false;
  }
  if (record) {
    write(KEY, [
      ...entries,
      {
        id: newId(),
        kind: 'quest',
        questId: quest.id,
        title: quest.title,
        category: quest.category,
        minutes,
        note: cleanNote(input.reflection),
        completedAt: now.toISOString(),
        localDate: input.localDate ?? localDayKey(now),
      } satisfies StoredEntry,
    ]);
  }
  cancelStart(quest.id);
  return record;
}

export function recordSession(input: SessionInput, now: Date = new Date()): void {
  write(KEY, [
    ...readEntries(),
    {
      id: newId(),
      kind: 'session',
      title: 'Time outside',
      minutes: validMinutes(input.minutes),
      note: cleanNote(input.note),
      completedAt: now.toISOString(),
      localDate: input.localDate ?? localDayKey(now),
    } satisfies StoredEntry,
  ]);
}

export function updateNote(id: string, note: string | undefined): void {
  const entries = readEntries();
  if (!entries.some((e) => e.id === id)) throw new Error('That entry could not be found.');
  write(KEY, entries.map((e) => (e.id === id ? { ...e, note: cleanNote(note) } : e)));
}

export function removeEntry(id: string): void {
  const entries = readEntries();
  if (!entries.some((e) => e.id === id)) throw new Error('That entry could not be found.');
  write(KEY, entries.filter((e) => e.id !== id));
}

// ---- starts
export function readStarts(): Record<string, string> {
  const raw = readJson(STARTS_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
}

export function startQuest(id: string, now: Date = new Date()): void {
  const starts = readStarts();
  if (!starts[id]) write(STARTS_KEY, { ...starts, [id]: now.toISOString() });
}

export function cancelStart(id: string): void {
  const starts = readStarts();
  if (id in starts) {
    delete starts[id];
    write(STARTS_KEY, starts);
  }
}

export function clearAll(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
    window.localStorage.removeItem(STARTS_KEY);
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}
/** Part 1 name, kept so older imports still work. */
export const clearCompletions = clearAll;

// ---- progress
function milestone(id: string, title: string, description: string, target: number, current: number, unit: Milestone['unit']): Milestone {
  return { id, title, description, target, current: Math.min(current, target), unit, achieved: current >= target };
}

export function buildProgress(entries: StoredEntry[], today: string = localDayKey(new Date())): Progress {
  const quests = entries.filter((e) => e.kind === 'quest');
  const minutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const days = entries.map((e) => e.localDate);
  const streaks = computeStreaksFromDays(days, today);
  const categories = new Set(quests.map((e) => e.category).filter(Boolean)).size;
  const notes = entries.filter((e) => e.note).length;
  const sorted = [...entries].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const windowStart = new Date(todayMs - 27 * 86_400_000).toISOString().slice(0, 10);

  return {
    completedActivities: quests.length,
    outdoorMinutes: minutes,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    milestones: [
      milestone('first-quest', 'First step', 'Complete your first quest.', 1, quests.length, 'quests'),
      milestone('three-quests', 'Three and counting', 'Complete three quests.', 3, quests.length, 'quests'),
      milestone('ten-quests', 'Ten quests', 'Complete ten quests.', 10, quests.length, 'quests'),
      milestone('streak-3', 'Three days running', 'Be outside on three days in a row.', 3, streaks.longest, 'days'),
      milestone('hour-outside', 'An hour outside', 'Record 60 outdoor minutes.', 60, minutes, 'minutes'),
      milestone('five-hours', 'Five hours outdoors', 'Record 300 outdoor minutes.', 300, minutes, 'minutes'),
      milestone('variety-3', 'A bit of everything', 'Complete quests from three different categories.', 3, categories, 'quests'),
      milestone('first-reflection', 'First reflection', 'Write a short note about an outing.', 1, notes, 'quests'),
    ],
    recent: sorted.slice(0, MAX_RECENT).map((e) => ({
      id: e.id,
      kind: e.kind,
      questId: e.questId ?? `session-${e.id}`,
      title: e.title,
      completedAt: e.completedAt,
      localDate: e.localDate,
      minutes: e.minutes,
      note: e.note,
    })),
    activeDays: new Set(days).size,
    sessionsLogged: entries.filter((e) => e.kind === 'session').length,
    activeDates: Array.from(new Set(days.filter((d) => d >= windowStart && d <= today))).sort(),
  };
}
