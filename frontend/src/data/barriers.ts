import { Clock, CloudRain, Footprints, Home, Leaf, PersonStanding, Volume1, Wallet, type LucideIcon } from 'lucide-react';
import type { BarrierId } from '../types';

export interface BarrierMeta {
  id: BarrierId;
  label: string;
  /** One plain sentence about what choosing this changes. */
  effect: string;
  icon: LucideIcon;
}

/**
 * Practical limits, not excuses. Choosing one narrows the suggestions to things that genuinely fit it.
 * The wording is deliberately neutral: nothing here suggests the person should have done more.
 */
export const BARRIERS: BarrierMeta[] = [
  { id: 'short-time', label: 'Only 10 to 20 minutes', effect: 'Shows quests of 20 minutes or less.', icon: Clock },
  { id: 'no-budget', label: 'Almost no budget', effect: 'Shows only quests marked free.', icon: Wallet },
  { id: 'low-energy', label: 'Low energy today', effect: 'Shows only low-energy quests.', icon: Leaf },
  { id: 'solo', label: 'I would rather go solo', effect: 'Shows only quests that work alone.', icon: PersonStanding },
  { id: 'accessible', label: 'Need accessible or low-impact', effect: 'Shows low-energy quests tagged step-free.', icon: Footprints },
  { id: 'near-home', label: 'Cannot travel far', effect: 'Shows quests that start at your door or a short walk away.', icon: Home },
  { id: 'bad-weather', label: 'Weather is poor', effect: 'Puts weather-proof quests first and adds an indoor fallback.', icon: CloudRain },
  { id: 'quiet', label: 'Prefer somewhere quiet', effect: 'Shows quests tagged low-sensory.', icon: Volume1 },
];

export const BARRIER_BY_ID: Record<BarrierId, BarrierMeta> = Object.fromEntries(BARRIERS.map((b) => [b.id, b])) as Record<
  BarrierId,
  BarrierMeta
>;

/** Added to the planner's notes when "Weather is poor" is chosen. The planner has no weather field. */
export const WEATHER_NOTE = 'Weather is poor today, prefer sheltered options.';
