/**
 * Centralised API service. Components never call fetch directly.
 *
 * Real mode:  VITE_USE_MOCK=false  -> requests go to VITE_API_BASE_URL.
 * Mock mode:  default              -> clearly labelled built-in sample data.
 *
 * The backend speaks two dialects: Part 2 (planner, activities, health) uses snake_case and `{ items, count }`
 * envelopes, Part 3 (quests, progress, places) uses camelCase. Everything is converted to one set of frontend types
 * here, and every response is validated before it is rendered. See docs/api.md.
 */
import type {
  Activity,
  ActivityPlan,
  CompleteQuestInput,
  CompleteQuestResponse,
  DataSource,
  GeocodeResult,
  HealthStatus,
  PlanPreferences,
  Place,
  PlaceCategory,
  Progress,
  Quest,
  SessionInput,
} from '../types';
import { localDayKey } from '../utils/dates';
import { API_BASE_URL, USE_MOCK } from './config';
import { mockApi } from './mock';
import { getProfileId } from './profile';
import {
  ResponseShapeError,
  parseActivities,
  parseCompleteResponse,
  parseGeocode,
  parseHealth,
  parsePlaceCategories,
  parsePlanResponse,
  parsePlaces,
  parseProgress,
  parseQuest,
  parseQuests,
} from './validators';

export class ApiError extends Error {
  status?: number;
  /** True when the caller cancelled the request on purpose. Callers should ignore these. */
  aborted: boolean;

  constructor(message: string, status?: number, aborted = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.aborted = aborted;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const STATUS_MESSAGES: Record<number, string> = {
  404: 'We could not find that. It may have been removed.',
  422: 'Some of the information was not valid. Please check it and try again.',
  429: 'Too many requests in a short time. Please wait a moment and try again.',
  502: 'A service we depend on sent an unexpected reply. Please try again.',
  503: 'A service we depend on is unavailable right now. Please try again later.',
  504: 'A service we depend on took too long to answer. Try a smaller search area.',
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = 20_000, signal } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Profile-Id': getProfileId() };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const payload = (await response.json()) as { error?: { message?: unknown }; detail?: unknown };
        // Backend error shape: { error: { code, message } }. Plain FastAPI errors use { detail }.
        if (typeof payload.error?.message === 'string') detail = payload.error.message;
        else if (typeof payload.detail === 'string') detail = payload.detail;
      } catch {
        /* response had no JSON body */
      }
      throw new ApiError(detail || STATUS_MESSAGES[response.status] || `The server returned an error (${response.status}).`, response.status);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('The server sent a reply we could not read. Please try again.', response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (timedOut) throw new ApiError('The request took too long. Please try again.');
      throw new ApiError('Request cancelled.', undefined, true);
    }
    throw new ApiError('Could not reach the TouchGrass server. Check that the backend is running and try again.');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Runs a validator and turns a shape problem into a readable ApiError. */
function checked<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ResponseShapeError) {
      throw new ApiError('The server sent data in a format we did not expect. Please try again or contact the site owner.');
    }
    throw error;
  }
}

export const PLAN_TIMEOUT_MS = 150_000;
const today = (): string => localDayKey(new Date());
const enc = encodeURIComponent;

export interface PlaceSearchOptions {
  /** Category ids from getPlaceCategories(). Omit for the server default. */
  categories?: string[];
  limit?: number;
  signal?: AbortSignal;
}

export const api = {
  /** Where data currently comes from. The UI uses this to label mock content. */
  source: (USE_MOCK ? 'mock' : 'api') as DataSource,

  health: async (signal?: AbortSignal): Promise<HealthStatus> => {
    if (USE_MOCK) return mockApi.health();
    const data = await request<unknown>('/api/health', { timeoutMs: 8_000, signal });
    return checked(() => parseHealth(data));
  },

  /**
   * The local model can take a minute or more (the first call also loads it into memory), so this waits up to
   * 150 s. The backend never hangs longer than OLLAMA_TIMEOUT_SECONDS (default 120 s) before answering with a
   * clearly labelled fallback plan.
   */
  createPlan: async (preferences: PlanPreferences): Promise<ActivityPlan> => {
    if (USE_MOCK) return mockApi.createPlan(preferences);
    const data = await request<unknown>('/api/plan', { method: 'POST', body: preferences, timeoutMs: PLAN_TIMEOUT_MS });
    return checked(() => parsePlanResponse(data));
  },

  getActivities: async (): Promise<Activity[]> => {
    if (USE_MOCK) return mockApi.getActivities();
    const data = await request<unknown>('/api/activities');
    return checked(() => parseActivities(data));
  },

  getQuests: async (): Promise<Quest[]> => {
    if (USE_MOCK) return mockApi.getQuests();
    const data = await request<unknown>('/api/quests');
    return checked(() => parseQuests(data));
  },

  startQuest: async (questId: string): Promise<Quest> => {
    if (USE_MOCK) return mockApi.startQuest(questId);
    const data = await request<unknown>(`/api/quests/${enc(questId)}/start`, { method: 'POST' });
    return checked(() => {
      const quest = parseQuest(data);
      if (!quest) throw new ResponseShapeError('quest');
      return quest;
    });
  },

  cancelQuestStart: async (questId: string): Promise<Quest> => {
    if (USE_MOCK) return mockApi.cancelQuestStart(questId);
    const data = await request<unknown>(`/api/quests/${enc(questId)}/start`, { method: 'DELETE' });
    return checked(() => {
      const quest = parseQuest(data);
      if (!quest) throw new ResponseShapeError('quest');
      return quest;
    });
  },

  /** `input` is optional: with no body this is exactly the Part 1 call. */
  completeQuest: async (questId: string, input?: CompleteQuestInput): Promise<CompleteQuestResponse> => {
    if (USE_MOCK) return mockApi.completeQuest(questId, input);
    const body = { ...input, localDate: input?.localDate ?? today() };
    const data = await request<unknown>(`/api/quests/${enc(questId)}/complete?today=${today()}`, { method: 'POST', body });
    return checked(() => parseCompleteResponse(data));
  },

  getProgress: async (): Promise<Progress> => {
    if (USE_MOCK) return mockApi.getProgress();
    const data = await request<unknown>(`/api/progress?today=${today()}`);
    return checked(() => parseProgress(data));
  },

  logSession: async (input: SessionInput): Promise<Progress> => {
    if (USE_MOCK) return mockApi.logSession(input);
    const data = await request<unknown>(`/api/outdoor-sessions?today=${today()}`, {
      method: 'POST',
      body: { ...input, localDate: input.localDate ?? today() },
    });
    return checked(() => parseProgress(data));
  },

  updateEntryNote: async (entryId: string, note: string | undefined): Promise<Progress> => {
    if (USE_MOCK) return mockApi.updateEntryNote(entryId, note);
    const data = await request<unknown>(`/api/progress/entries/${enc(entryId)}?today=${today()}`, {
      method: 'PATCH',
      body: { note: note ?? null },
    });
    return checked(() => parseProgress(data));
  },

  deleteEntry: async (entryId: string): Promise<Progress> => {
    if (USE_MOCK) return mockApi.deleteEntry(entryId);
    const data = await request<unknown>(`/api/progress/entries/${enc(entryId)}?today=${today()}`, { method: 'DELETE' });
    return checked(() => parseProgress(data));
  },

  getPlaces: async (lat: number, lon: number, radiusMeters: number, options: PlaceSearchOptions = {}): Promise<Place[]> => {
    if (USE_MOCK) return mockApi.getPlaces();
    const query = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(radiusMeters) });
    if (options.categories && options.categories.length > 0) query.set('categories', options.categories.join(','));
    if (options.limit) query.set('limit', String(options.limit));
    const data = await request<unknown>(`/api/places?${query.toString()}`, { timeoutMs: 40_000, signal: options.signal });
    return checked(() => parsePlaces(data));
  },

  getPlaceCategories: async (): Promise<PlaceCategory[]> => {
    if (USE_MOCK) return mockApi.getPlaceCategories();
    const data = await request<unknown>('/api/places/categories');
    return checked(() => parsePlaceCategories(data));
  },

  /** Turns a typed place name into candidate coordinates. Only called after the person submits the search form. */
  geocode: async (query: string, signal?: AbortSignal): Promise<GeocodeResult[]> => {
    if (USE_MOCK) return mockApi.geocode();
    const data = await request<unknown>(`/api/geocode?q=${enc(query)}`, { timeoutMs: 15_000, signal });
    return checked(() => parseGeocode(data));
  },
};
