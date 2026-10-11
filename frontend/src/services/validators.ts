/**
 * Runtime validation of data that arrives over the network. The backend is trusted far more than a public
 * map service, but we still never render anything we have not checked: a wrong shape becomes a clear error,
 * and individual bad items are dropped instead of breaking the page.
 */
import { INTEREST_META } from '../data/options';
import type {
  AccessibilityNeed,
  Activity,
  ActivityPlan,
  AiStatus,
  Budget,
  Company,
  Difficulty,
  Energy,
  GeocodeResult,
  HealthStatus,
  Interest,
  Milestone,
  Place,
  PlaceCategory,
  PlanStep,
  Progress,
  ProgressEntry,
  Quest,
  QuestCategory,
  QuestStatus,
  TravelNeed,
} from '../types';
import { isValidLatLon } from '../utils/geo';

export class ResponseShapeError extends Error {
  constructor(what: string) {
    super(`Unexpected ${what} response`);
    this.name = 'ResponseShapeError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 300): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const strings = (v: unknown, max = 300): string[] | undefined =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter((x): x is string => x !== undefined) : undefined;
const listOf = <T extends string>(v: unknown, allowed: readonly T[]): T[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is T => typeof x === 'string' && (allowed as readonly string[]).includes(x)) : undefined;
function httpUrl(v: unknown): string | undefined {
  const s = str(v, 400);
  if (!s) return undefined;
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- places
export function parsePlace(raw: unknown): Place | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id, 80);
  const name = str(raw.name, 160);
  const category = str(raw.category, 80);
  if (!id || !name || !category || !isValidLatLon(raw.lat, raw.lon)) return null;
  const distance = num(raw.distanceMeters);
  return {
    id,
    name,
    category,
    lat: raw.lat as number,
    lon: raw.lon as number,
    distanceMeters: distance !== undefined && distance >= 0 ? distance : undefined,
    categoryId: str(raw.categoryId, 40),
    osmUrl: httpUrl(raw.osmUrl),
    openingHours: str(raw.openingHours, 200),
    wheelchair: oneOf(raw.wheelchair, ['yes', 'limited', 'no'] as const),
    website: httpUrl(raw.website),
    named: typeof raw.named === 'boolean' ? raw.named : undefined,
  };
}

export function parsePlaces(data: unknown): Place[] {
  if (!Array.isArray(data)) throw new ResponseShapeError('places');
  return data.map(parsePlace).filter((p): p is Place => p !== null);
}

export function parsePlaceCategories(data: unknown): PlaceCategory[] {
  if (!Array.isArray(data)) throw new ResponseShapeError('categories');
  return data
    .map((item): PlaceCategory | null => {
      if (!isRecord(item)) return null;
      const id = str(item.id, 40);
      const label = str(item.label, 80);
      return id && label ? { id, label, defaultOn: item.defaultOn === true } : null;
    })
    .filter((c): c is PlaceCategory => c !== null);
}

export function parseGeocode(data: unknown): GeocodeResult[] {
  if (!Array.isArray(data)) throw new ResponseShapeError('place search');
  return data
    .map((item): GeocodeResult | null => {
      if (!isRecord(item)) return null;
      const label = str(item.label, 200);
      return label && isValidLatLon(item.lat, item.lon) ? { label, lat: item.lat as number, lon: item.lon as number } : null;
    })
    .filter((r): r is GeocodeResult => r !== null);
}

// ---------------------------------------------------------------- quests
const CATEGORIES = ['nature-observation', 'photography', 'gardening', 'walking', 'kindness', 'social'] as const satisfies readonly QuestCategory[];
const STATUSES = ['available', 'in-progress', 'completed'] as const satisfies readonly QuestStatus[];
const DIFFICULTIES = ['easy', 'moderate', 'challenging'] as const satisfies readonly Difficulty[];
const BUDGETS = ['free', 'low', 'flexible'] as const satisfies readonly Budget[];
const ENERGIES = ['low', 'medium', 'high'] as const satisfies readonly Energy[];
const COMPANIES = ['solo', 'friends', 'family', 'group'] as const satisfies readonly Company[];
const ACCESS = ['step-free', 'seating', 'shade', 'low-sensory', 'short-distance'] as const satisfies readonly AccessibilityNeed[];
const TRAVEL = ['doorstep', 'nearby', 'short-trip'] as const satisfies readonly TravelNeed[];
const INTERESTS = ['walking', 'nature', 'photography', 'gardening', 'fitness', 'birdwatching', 'creativity', 'social'] as const satisfies readonly Interest[];

export function parseQuest(raw: unknown): Quest | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id, 80);
  const title = str(raw.title, 160);
  const summary = str(raw.summary, 600);
  const category = oneOf(raw.category, CATEGORIES);
  const steps = strings(raw.steps, 400);
  const minutes = num(raw.minutes);
  if (!id || !title || !summary || !category || !steps || steps.length === 0 || minutes === undefined) return null;

  const fb = isRecord(raw.indoorFallback) ? raw.indoorFallback : null;
  const fbTitle = fb ? str(fb.title, 120) : undefined;
  const fbSummary = fb ? str(fb.summary, 400) : undefined;
  const fbMinutes = fb ? num(fb.minutes) : undefined;

  return {
    id,
    title,
    summary,
    category,
    difficulty: oneOf(raw.difficulty, DIFFICULTIES) ?? 'easy',
    minutes,
    steps,
    tip: str(raw.tip, 400),
    status: oneOf(raw.status, STATUSES) ?? 'available',
    completedAt: str(raw.completedAt, 40),
    objective: str(raw.objective, 400),
    equipment: strings(raw.equipment, 120),
    completionCriteria: strings(raw.completionCriteria, 300),
    budget: oneOf(raw.budget, BUDGETS),
    energy: oneOf(raw.energy, ENERGIES),
    accessibility: listOf(raw.accessibility, ACCESS),
    company: listOf(raw.company, COMPANIES),
    interests: listOf(raw.interests, INTERESTS),
    travel: oneOf(raw.travel, TRAVEL),
    weatherSensitive: typeof raw.weatherSensitive === 'boolean' ? raw.weatherSensitive : undefined,
    indoorFallback: fbTitle && fbSummary && fbMinutes !== undefined ? { title: fbTitle, summary: fbSummary, minutes: fbMinutes } : undefined,
    origin: raw.origin === 'curated' ? 'curated' : undefined,
    startedAt: str(raw.startedAt, 40),
    completionCount: num(raw.completionCount),
  };
}

export function parseQuests(data: unknown): Quest[] {
  if (!Array.isArray(data)) throw new ResponseShapeError('quests');
  return data.map(parseQuest).filter((q): q is Quest => q !== null);
}

// ---------------------------------------------------------------- progress
function parseEntry(raw: unknown): ProgressEntry | null {
  if (!isRecord(raw)) return null;
  const questId = str(raw.questId, 80);
  const title = str(raw.title, 160);
  const completedAt = str(raw.completedAt, 40);
  const minutes = num(raw.minutes);
  if (!questId || !title || !completedAt || minutes === undefined) return null;
  return {
    questId,
    title,
    completedAt,
    minutes,
    id: str(raw.id, 40),
    kind: oneOf(raw.kind, ['quest', 'session'] as const),
    note: str(raw.note, 600),
    localDate: str(raw.localDate, 10),
  };
}

function parseMilestone(raw: unknown): Milestone | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id, 60);
  const title = str(raw.title, 120);
  const description = str(raw.description, 300);
  const target = num(raw.target);
  const current = num(raw.current);
  const unit = oneOf(raw.unit, ['quests', 'days', 'minutes'] as const);
  if (!id || !title || !description || target === undefined || target <= 0 || current === undefined || !unit) return null;
  return { id, title, description, target, current, unit, achieved: raw.achieved === true };
}

export function parseProgress(data: unknown): Progress {
  if (!isRecord(data)) throw new ResponseShapeError('progress');
  const completed = num(data.completedActivities);
  const minutes = num(data.outdoorMinutes);
  const current = num(data.currentStreak);
  const longest = num(data.longestStreak);
  if (completed === undefined || minutes === undefined || current === undefined || longest === undefined) {
    throw new ResponseShapeError('progress');
  }
  return {
    completedActivities: completed,
    outdoorMinutes: minutes,
    currentStreak: current,
    longestStreak: longest,
    milestones: Array.isArray(data.milestones) ? data.milestones.map(parseMilestone).filter((m): m is Milestone => m !== null) : [],
    recent: Array.isArray(data.recent) ? data.recent.map(parseEntry).filter((e): e is ProgressEntry => e !== null) : [],
    activeDays: num(data.activeDays),
    sessionsLogged: num(data.sessionsLogged),
    activeDates: strings(data.activeDates, 10),
    plansGenerated: num(data.plansGenerated),
  };
}

export function parseCompleteResponse(data: unknown): { quest: Quest; progress: Progress } {
  if (!isRecord(data)) throw new ResponseShapeError('completion');
  const quest = parseQuest(data.quest);
  if (!quest) throw new ResponseShapeError('completion');
  return { quest, progress: parseProgress(data.progress) };
}

// ---------------------------------------------------------------- Part 2 responses (snake_case, list envelopes)
const nonNegative = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && n >= 0 ? n : undefined;
};

function parseCost(raw: unknown): { min: number; max: number; currency: string } | null {
  if (!isRecord(raw)) return null;
  const min = nonNegative(raw.min);
  const max = nonNegative(raw.max);
  if (min === undefined || max === undefined) return null;
  return { min, max, currency: str(raw.currency, 8) ?? 'USD' };
}

/** `GET /api/activities` returns `{ items, count }` with snake_case fields. */
export function parseActivities(data: unknown): Activity[] {
  if (!isRecord(data) || !Array.isArray(data.items)) throw new ResponseShapeError('activities');
  const out: Activity[] = [];
  for (const raw of data.items) {
    if (!isRecord(raw)) continue;
    const id = str(raw.id, 80);
    const title = str(raw.title, 160);
    const summary = str(raw.description, 800);
    const minutes = nonNegative(raw.duration_minutes);
    const cost = parseCost(raw.estimated_cost);
    const interests = listOf(raw.interests, INTERESTS) ?? [];
    const category = oneOf(raw.category, INTERESTS);
    if (!id || !title || !summary || minutes === undefined || !cost || interests.length === 0) continue;
    out.push({
      id,
      title,
      summary,
      type: category ? INTEREST_META[category].label : 'Outdoor activity',
      minutes,
      cost,
      budget: oneOf(raw.budget, BUDGETS) ?? 'flexible',
      difficulty: oneOf(raw.difficulty, DIFFICULTIES) ?? 'easy',
      energy: oneOf(raw.energy_required, ENERGIES) ?? 'medium',
      interests,
      accessibility: listOf(raw.accessibility, ACCESS) ?? [],
      company: listOf(raw.suitable_for, COMPANIES) ?? [],
      checklist: strings(raw.checklist, 200) ?? [],
      tips: strings(raw.tips, 300) ?? [],
      steps: strings(raw.steps, 400),
      challenge: str(raw.challenge, 300),
    });
  }
  return out;
}

function parseStep(raw: unknown): PlanStep | null {
  if (!isRecord(raw)) return null;
  const order = num(raw.order);
  const title = str(raw.title, 160);
  const description = str(raw.description, 600);
  const minutes = nonNegative(raw.duration_minutes);
  return order !== undefined && title && description && minutes !== undefined
    ? { order, title, description, durationMinutes: minutes }
    : null;
}

/** `POST /api/plan` returns `{ generated_by, model, fallback_reason, message, plan }`. */
export function parsePlanResponse(data: unknown): ActivityPlan {
  if (!isRecord(data) || !isRecord(data.plan)) throw new ResponseShapeError('plan');
  const plan = data.plan;
  const source = oneOf(data.generated_by, ['ai', 'fallback'] as const);
  const id = str(plan.id, 80);
  const title = str(plan.title, 200);
  const summary = str(plan.summary, 800);
  const total = nonNegative(plan.total_minutes);
  const cost = parseCost(plan.estimated_cost);
  const backup = isRecord(plan.backup_plan) ? plan.backup_plan : null;
  const backupTitle = backup ? str(backup.title, 160) : undefined;
  const backupSummary = backup ? str(backup.description, 500) : undefined;
  const backupMinutes = backup ? nonNegative(backup.duration_minutes) : undefined;
  const steps = Array.isArray(plan.steps) ? plan.steps.map(parseStep).filter((s): s is PlanStep => s !== null) : [];
  const checklist = strings(plan.checklist, 200) ?? [];

  if (!source || !id || !title || !summary || total === undefined || !cost || !backupTitle || !backupSummary || backupMinutes === undefined || steps.length === 0) {
    throw new ResponseShapeError('plan');
  }
  const costNote = isRecord(plan.estimated_cost) ? str(plan.estimated_cost.assumptions, 400) : undefined;
  return {
    id,
    title,
    summary,
    reason: str(plan.why_it_matches, 500),
    durationMinutes: total,
    estimatedCost: cost,
    checklist: checklist.map((label, index) => ({ id: `${id}-c${index}`, label })),
    tips: [],
    backup: { title: backupTitle, summary: backupSummary, durationMinutes: backupMinutes, whenToUse: backup ? str(backup.when_to_use, 300) : undefined },
    generatedAt: str(plan.generated_at, 40) ?? new Date().toISOString(),
    source,
    model: source === 'ai' ? (str(data.model, 80) ?? str(plan.model, 80)) : undefined,
    steps,
    challenge: str(plan.challenge, 300),
    accessibilityAdaptations: strings(plan.accessibility_adaptations, 300),
    safetyReminders: strings(plan.safety_reminders, 300),
    phoneAwaySuggestion: str(plan.phone_away_suggestion, 300),
    costAssumptions: costNote,
    notice: source === 'fallback' ? (str(data.message, 400) ?? 'The AI model was not used for this plan.') : undefined,
    fallbackReason: source === 'fallback' ? str(data.fallback_reason, 60) : undefined,
  };
}

/** `GET /api/health`. */
export function parseHealth(data: unknown): HealthStatus {
  if (!isRecord(data)) throw new ResponseShapeError('health');
  const status = oneOf(data.status, ['ok', 'degraded', 'error'] as const);
  if (!status) throw new ResponseShapeError('health');
  const ai = isRecord(data.ai) ? data.ai : null;
  const aiStatus = ai ? oneOf(ai.status, ['ready', 'model_missing', 'unreachable', 'disabled'] as const satisfies readonly AiStatus[]) : undefined;
  return {
    status,
    ai: ai && aiStatus ? { status: aiStatus, model: str(ai.model, 80) ?? '', setupHint: str(ai.setup_hint, 300) } : undefined,
  };
}
