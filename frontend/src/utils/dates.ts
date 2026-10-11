export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Streaks from local calendar-day keys (YYYY-MM-DD). The current streak stays alive if the latest day is today or yesterday. */
export function computeStreaksFromDays(dayKeys: string[], today: string): { current: number; longest: number } {
  const keys = Array.from(new Set(dayKeys.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)))).sort();
  if (keys.length === 0) return { current: 0, longest: 0 };

  const days = keys.map(dayNumber);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] - days[i - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  let current = 0;
  if (dayNumber(today) - days[days.length - 1] <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i -= 1) {
      if (days[i] - days[i - 1] === 1) current += 1;
      else break;
    }
  }
  return { current, longest };
}

/** Same as above for ISO timestamps (converted to the device's local day). Kept for Part 1 compatibility. */
export function computeStreaks(isoDates: string[], now: Date = new Date()): { current: number; longest: number } {
  return computeStreaksFromDays(
    isoDates.map((iso) => localDayKey(new Date(iso))),
    localDayKey(now),
  );
}

/** The last `count` local days ending today, oldest first. */
export function lastDays(count: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(localDayKey(d));
  }
  return out;
}
