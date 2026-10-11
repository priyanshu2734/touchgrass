/**
 * MOCK API. Mirrors the shape of the FastAPI responses so the UI can switch to the real backend by changing
 * VITE_USE_MOCK, without redesign. Everything here is clearly labelled as demo content in the UI.
 */
import { MOCK_ACTIVITIES } from '../../data/activities';
import { DEMO_PLACES, PLACE_CATEGORIES } from '../../data/demoPlaces';
import { MOCK_QUESTS } from '../../data/quests';
import type {
  Activity,
  ActivityPlan,
  CompleteQuestInput,
  CompleteQuestResponse,
  GeocodeResult,
  HealthStatus,
  Place,
  PlaceCategory,
  PlanPreferences,
  Progress,
  Quest,
  SessionInput,
} from '../../types';
import { buildMockPlan } from './planner';
import {
  buildProgress,
  cancelStart,
  readEntries,
  readStarts,
  recordCompletion,
  recordSession,
  removeEntry,
  startQuest,
  updateNote,
} from './store';

function delay<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function questsWithStatus(): Quest[] {
  const entries = readEntries().filter((e) => e.kind === 'quest');
  const starts = readStarts();
  return MOCK_QUESTS.map((seed): Quest => {
    const mine = entries.filter((e) => e.questId === seed.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const startedAt = starts[seed.id];
    const status = startedAt ? 'in-progress' : mine.length ? 'completed' : 'available';
    return { ...seed, status, startedAt, completedAt: mine[0]?.completedAt, completionCount: mine.length };
  });
}

function findQuest(id: string): Quest {
  const quest = questsWithStatus().find((item) => item.id === id);
  if (!quest) throw new Error('That quest could not be found.');
  return quest;
}

export const mockApi = {
  health: (): Promise<HealthStatus> => delay({ status: 'ok', mode: 'mock' }, 150),

  createPlan: async (prefs: PlanPreferences): Promise<ActivityPlan> => {
    await delay(null, 1400);
    return buildMockPlan(prefs);
  },

  getActivities: (): Promise<Activity[]> => delay(MOCK_ACTIVITIES, 500),

  getQuests: (): Promise<Quest[]> => delay(questsWithStatus(), 500),

  startQuest: async (questId: string): Promise<Quest> => {
    await delay(null, 250);
    findQuest(questId);
    startQuest(questId);
    return findQuest(questId);
  },

  cancelQuestStart: async (questId: string): Promise<Quest> => {
    await delay(null, 250);
    findQuest(questId);
    cancelStart(questId);
    return findQuest(questId);
  },

  completeQuest: async (questId: string, input: CompleteQuestInput = {}): Promise<CompleteQuestResponse> => {
    await delay(null, 500);
    const quest = findQuest(questId);
    recordCompletion(quest, input);
    return { quest: findQuest(questId), progress: buildProgress(readEntries()) };
  },

  getProgress: (): Promise<Progress> => delay(buildProgress(readEntries()), 400),

  logSession: async (input: SessionInput): Promise<Progress> => {
    await delay(null, 350);
    recordSession(input);
    return buildProgress(readEntries());
  },

  updateEntryNote: async (id: string, note: string | undefined): Promise<Progress> => {
    await delay(null, 250);
    updateNote(id, note);
    return buildProgress(readEntries());
  },

  deleteEntry: async (id: string): Promise<Progress> => {
    await delay(null, 250);
    removeEntry(id);
    return buildProgress(readEntries());
  },

  /** Demo places are fixed sample places in London. They are NOT near the search point and carry no distance. */
  getPlaces: (): Promise<Place[]> => delay(DEMO_PLACES, 600),

  getPlaceCategories: (): Promise<PlaceCategory[]> => delay(PLACE_CATEGORIES, 100),

  geocode: (): Promise<GeocodeResult[]> =>
    Promise.reject(new Error('Searching by place name needs the backend. In demo mode you can type coordinates such as 51.5, -0.12.')),
};
