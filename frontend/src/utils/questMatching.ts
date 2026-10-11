/**
 * Barrier-aware quest matching. Pure functions, unit tested.
 *
 * Principles:
 *  - Hard limits (time, budget, energy, accessibility, travel, solo) are never relaxed silently.
 *  - A quest is only claimed to meet a limit if its data says so. Missing data means "unknown", not "fine".
 *  - When nothing fits we say which single limit blocks the most options, and let the person decide.
 */
import { INTEREST_META } from '../data/options';
import type { AccessibilityNeed, BarrierId, Budget, Company, Energy, Interest, PlanPreferences, Quest, TravelNeed } from '../types';

const BUDGET_RANK: Record<Budget, number> = { free: 0, low: 1, flexible: 2 };
const ENERGY_RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 };
const TRAVEL_RANK: Record<TravelNeed, number> = { doorstep: 0, nearby: 1, 'short-trip': 2 };

export interface QuestConstraints {
  maxMinutes?: number;
  maxBudget?: Budget;
  maxEnergy?: Energy;
  requireSolo: boolean;
  preferredCompany?: Company;
  accessibility: AccessibilityNeed[];
  maxTravel?: TravelNeed;
  badWeather: boolean;
  interests: Interest[];
}

export const NO_CONSTRAINTS: QuestConstraints = { requireSolo: false, accessibility: [], badWeather: false, interests: [] };

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));
const lowerEnergy = (a: Energy | undefined, b: Energy): Energy => (a !== undefined && ENERGY_RANK[a] < ENERGY_RANK[b] ? a : b);

/** Base preferences (optional) plus any chosen barriers become one set of constraints. */
export function buildConstraints(
  barriers: BarrierId[],
  prefs: Partial<Pick<PlanPreferences, 'minutes' | 'budget' | 'energy' | 'interests' | 'company' | 'accessibility'>> = {},
): QuestConstraints {
  const c: QuestConstraints = {
    ...NO_CONSTRAINTS,
    maxMinutes: prefs.minutes !== undefined && prefs.minutes < 120 ? prefs.minutes : undefined,
    maxBudget: prefs.budget && prefs.budget !== 'flexible' ? prefs.budget : undefined,
    maxEnergy: prefs.energy && prefs.energy !== 'high' ? prefs.energy : undefined,
    requireSolo: prefs.company === 'solo',
    preferredCompany: prefs.company && prefs.company !== 'solo' ? prefs.company : undefined,
    accessibility: [...(prefs.accessibility ?? [])],
    interests: [...(prefs.interests ?? [])],
  };

  for (const barrier of barriers) {
    switch (barrier) {
      case 'short-time':
        c.maxMinutes = Math.min(c.maxMinutes ?? 20, 20);
        break;
      case 'no-budget':
        c.maxBudget = 'free';
        break;
      case 'low-energy':
        c.maxEnergy = 'low';
        break;
      case 'solo':
        c.requireSolo = true;
        break;
      case 'accessible':
        c.accessibility = unique([...c.accessibility, 'step-free']);
        c.maxEnergy = lowerEnergy(c.maxEnergy, 'low');
        break;
      case 'near-home':
        c.maxTravel = 'nearby';
        break;
      case 'bad-weather':
        c.badWeather = true;
        break;
      case 'quiet':
        c.accessibility = unique([...c.accessibility, 'low-sensory']);
        break;
    }
  }
  return c;
}

export function passesHardLimits(quest: Quest, c: QuestConstraints): boolean {
  if (c.maxMinutes !== undefined && quest.minutes > c.maxMinutes) return false;
  if (c.maxBudget !== undefined && (quest.budget === undefined || BUDGET_RANK[quest.budget] > BUDGET_RANK[c.maxBudget])) return false;
  if (c.maxEnergy !== undefined && (quest.energy === undefined || ENERGY_RANK[quest.energy] > ENERGY_RANK[c.maxEnergy])) return false;
  if (c.requireSolo && !(quest.company ?? []).includes('solo')) return false;
  if (c.accessibility.length > 0 && !c.accessibility.every((need) => (quest.accessibility ?? []).includes(need))) return false;
  if (c.maxTravel !== undefined && (quest.travel === undefined || TRAVEL_RANK[quest.travel] > TRAVEL_RANK[c.maxTravel])) return false;
  return true;
}

export interface QuestMatch {
  quest: Quest;
  score: number;
  /** Why it fits, in plain words. Only things the quest data actually says. */
  reasons: string[];
  /** Honest notes the person should see before choosing it. */
  caveats: string[];
  /** True when the indoor fallback should be shown prominently (poor weather on a weather-sensitive quest). */
  suggestFallback: boolean;
}

export function scoreQuest(quest: Quest, c: QuestConstraints): QuestMatch {
  let score = 0;
  const reasons: string[] = [];
  const caveats: string[] = [];

  if (c.maxMinutes !== undefined) {
    reasons.push(`Takes about ${quest.minutes} min (you have ${c.maxMinutes})`);
    score += (quest.minutes / c.maxMinutes) * 1.5;
  }
  if (c.maxBudget === 'free') reasons.push('Free');
  else if (c.maxBudget === 'low') reasons.push(quest.budget === 'free' ? 'Free' : 'Low cost');
  if (c.maxEnergy === 'low') reasons.push('Low energy');
  if (c.requireSolo) reasons.push('Works on your own');
  if (c.maxTravel === 'nearby') reasons.push(quest.travel === 'doorstep' ? 'Starts at your door' : 'Starts a short walk away');
  if (c.maxTravel === 'nearby' && quest.travel === 'doorstep') score += 1;
  if (c.accessibility.length > 0) reasons.push(`Tagged ${c.accessibility.join(', ')}`);

  const overlap = (quest.interests ?? []).filter((interest) => c.interests.includes(interest));
  if (overlap.length > 0) {
    score += overlap.length * 3;
    reasons.push(`Matches your interest in ${overlap.map((i) => INTEREST_META[i].label.toLowerCase()).join(', ')}`);
  }
  if (c.preferredCompany && (quest.company ?? []).includes(c.preferredCompany)) score += 2;

  let suggestFallback = false;
  if (c.badWeather) {
    if (quest.weatherSensitive === false) {
      score += 3;
      reasons.push('Works in poor weather');
    } else if (quest.weatherSensitive === true) {
      caveats.push('Better in decent weather. The indoor fallback below works today.');
      suggestFallback = true;
      score -= 1;
    }
  }
  if (c.accessibility.length > 0) {
    caveats.push('Tags describe what the quest can be adapted to. Check the actual route and place yourself.');
  }
  if (quest.status === 'in-progress') {
    score += 2;
    reasons.unshift('You already started this one');
  }
  if (quest.status === 'completed') score -= 1.5; // gently surface new quests, still allow repeats
  if (quest.difficulty === 'easy') score += 0.5;

  return { quest, score, reasons, caveats, suggestFallback };
}

export type ConstraintKey = 'time' | 'budget' | 'energy' | 'solo' | 'accessibility' | 'travel';

export interface Relaxation {
  key: ConstraintKey;
  /** What dropping it means, in words the UI can show. */
  label: string;
  /** How many quests would fit if only this limit were removed. */
  count: number;
  /** Barrier chips that set this limit, so the UI can switch them off for the person. */
  barriers: BarrierId[];
}

export interface MatchResult {
  matches: QuestMatch[];
  total: number;
  /** Only filled when `matches` is empty: single limits that, if dropped, would give options. */
  relaxations: Relaxation[];
}

const RELAX_META: Record<ConstraintKey, { label: (c: QuestConstraints) => string; barriers: BarrierId[] }> = {
  time: { label: (c) => `the ${c.maxMinutes}-minute limit`, barriers: ['short-time'] },
  budget: { label: () => 'the budget limit', barriers: ['no-budget'] },
  energy: { label: () => 'the low-energy limit', barriers: ['low-energy', 'accessible'] },
  solo: { label: () => 'going solo', barriers: ['solo'] },
  accessibility: { label: (c) => `the ${c.accessibility.join(' and ')} need`, barriers: ['accessible', 'quiet'] },
  travel: { label: () => 'the stay-close-to-home limit', barriers: ['near-home'] },
};

export function dropConstraint(c: QuestConstraints, key: ConstraintKey): QuestConstraints {
  switch (key) {
    case 'time':
      return { ...c, maxMinutes: undefined };
    case 'budget':
      return { ...c, maxBudget: undefined };
    case 'energy':
      return { ...c, maxEnergy: undefined };
    case 'solo':
      return { ...c, requireSolo: false };
    case 'accessibility':
      return { ...c, accessibility: [] };
    case 'travel':
      return { ...c, maxTravel: undefined };
  }
}

function activeKeys(c: QuestConstraints): ConstraintKey[] {
  const keys: ConstraintKey[] = [];
  if (c.maxMinutes !== undefined) keys.push('time');
  if (c.maxBudget !== undefined) keys.push('budget');
  if (c.maxEnergy !== undefined) keys.push('energy');
  if (c.requireSolo) keys.push('solo');
  if (c.accessibility.length > 0) keys.push('accessibility');
  if (c.maxTravel !== undefined) keys.push('travel');
  return keys;
}

export function matchQuests(quests: Quest[], c: QuestConstraints, limit = 6): MatchResult {
  const fitting = quests.filter((quest) => passesHardLimits(quest, c));
  const matches = fitting
    .map((quest) => scoreQuest(quest, c))
    .sort((a, b) => b.score - a.score || a.quest.minutes - b.quest.minutes || a.quest.title.localeCompare(b.quest.title));

  let relaxations: Relaxation[] = [];
  if (matches.length === 0) {
    relaxations = activeKeys(c)
      .map((key) => ({
        key,
        label: RELAX_META[key].label(c),
        barriers: RELAX_META[key].barriers,
        count: quests.filter((q) => passesHardLimits(q, dropConstraint(c, key))).length,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }
  return { matches: matches.slice(0, limit), total: matches.length, relaxations };
}
