import type { CostEstimate, TimeOption } from '../types';

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatCost(cost: CostEstimate): string {
  if (cost.max <= 0) return 'Free';
  const fmt = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: cost.currency,
    maximumFractionDigits: 0,
  });
  return cost.min === cost.max ? fmt.format(cost.max) : `${fmt.format(cost.min)} to ${fmt.format(cost.max)}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeOptionLabel(minutes: TimeOption): string {
  return minutes === 120 ? '120+ min' : `${minutes} min`;
}

export const TIME_OPTIONS: TimeOption[] = [10, 20, 30, 60, 120];

export function nearestTimeOption(minutes: number): TimeOption {
  return TIME_OPTIONS.find((option) => option >= minutes) ?? 120;
}

export function isTimeOption(value: number): value is TimeOption {
  return (TIME_OPTIONS as number[]).includes(value);
}

/** Small deterministic hash used to vary generated artwork per item. */
export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  }
  return (hash % 97) + 1;
}
