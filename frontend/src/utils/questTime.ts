import type { Quest } from '../types';

/**
 * Suggests the minutes to pre-fill when completing a quest. If the person pressed "Start" recently,
 * the elapsed time is a good guess; otherwise the quest's own suggested duration. It is only a
 * suggestion: the person always confirms the number, so recorded minutes come from their action.
 */
export function suggestMinutes(quest: Pick<Quest, 'minutes' | 'startedAt'>, now: Date = new Date()): { minutes: number; fromStart: boolean } {
  if (quest.startedAt) {
    const elapsed = Math.round((now.getTime() - new Date(quest.startedAt).getTime()) / 60_000);
    if (Number.isFinite(elapsed) && elapsed >= 1 && elapsed <= 360) return { minutes: elapsed, fromStart: true };
  }
  return { minutes: quest.minutes, fromStart: false };
}

export function minutesAgo(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}
