/**
 * Runs the frontend's own API client against a REAL running backend. Skipped unless VITE_E2E_URL is set:
 *
 *   (backend)  python -m tests.e2e_server 8765
 *   (frontend) VITE_E2E_URL=http://127.0.0.1:8765 npx vitest run src/e2e.contract.test.ts
 *
 * It checks that URLs, request bodies, headers and response shapes agree between frontend and backend.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const URL_UNDER_TEST = import.meta.env.VITE_E2E_URL;
type Api = typeof import('./services/api').api;
let api: Api;

describe.skipIf(!URL_UNDER_TEST)('frontend API client <-> real backend', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.stubEnv('VITE_API_BASE_URL', URL_UNDER_TEST as string);
    window.localStorage.setItem('touchgrass.profile', `e2e-${Date.now().toString(36)}-aaaa`);
    api = (await import('./services/api')).api;
  });
  afterAll(() => vi.unstubAllEnvs());

  it('health: the AI is ready and the model is named', async () => {
    const health = await api.health();
    expect(health).toMatchObject({ status: 'ok', ai: { status: 'ready', model: 'gemma3:4b' } });
  });

  it('activities: the Part 2 catalogue arrives in the frontend shape', async () => {
    const activities = await api.getActivities();
    expect(activities.length).toBeGreaterThan(10);
    expect(activities[0]).toMatchObject({ id: expect.any(String), minutes: expect.any(Number), cost: { currency: 'USD' } });
  });

  it('planner: the AI plan comes back labelled as AI with steps', async () => {
    const plan = await api.createPlan({
      minutes: 60, budget: 'low', energy: 'medium', interests: ['nature', 'photography'], company: 'solo', accessibility: [],
      notes: 'I like quiet places', location: { label: 'Riverside', lat: 20.3, lon: 85.82 },
    });
    expect(plan).toMatchObject({ source: 'ai', model: 'gemma3:4b' });
    expect(plan.steps?.length).toBeGreaterThan(0);
    expect(plan.checklist.length).toBeGreaterThan(0);
    expect(plan.backup.title).toBeTruthy();
    expect(plan.notice).toBeUndefined();
  });

  it('places: categories, geocoding and nearby places match the frontend types', async () => {
    const categories = await api.getPlaceCategories();
    expect(categories.find((c) => c.id === 'park')).toMatchObject({ defaultOn: true });
    expect(await api.geocode('Puri')).toEqual([{ label: 'Puri, Testland', lat: 12.5, lon: 45.5 }]);
    const places = await api.getPlaces(20.3, 85.8, 5000);
    expect(places.map((p) => p.name)).toEqual(['Lakeside Park', 'Botanical Garden']);
    expect(places[0]).toMatchObject({ category: 'Park', openingHours: 'Mo-Su 06:00-20:00', osmUrl: expect.stringContaining('openstreetmap.org') });
    expect(places[0].wheelchair).toBeUndefined();
    expect(places[1]).toMatchObject({ wheelchair: 'yes', website: 'https://example.org/' });
  });

  it('quests and progress: start, complete, log time, edit a note, remove an entry, all persisted', async () => {
    const quests = await api.getQuests();
    expect(quests.length).toBe(25);
    expect(quests.every((q) => q.status === 'available')).toBe(true);

    const started = await api.startQuest('cloud-spotter');
    expect(started.status).toBe('in-progress');
    const done = await api.completeQuest('cloud-spotter', { minutesSpent: 14, reflection: 'Fast clouds' });
    expect(done.quest).toMatchObject({ status: 'completed', completionCount: 1 });
    expect(done.progress).toMatchObject({ completedActivities: 1, outdoorMinutes: 14, currentStreak: 1 });

    let progress = await api.logSession({ minutes: 20, note: 'Market walk' });
    expect(progress).toMatchObject({ outdoorMinutes: 34, sessionsLogged: 1 });
    const session = progress.recent.find((e) => e.kind === 'session');
    expect(session?.id).toBeTruthy();

    progress = await api.updateEntryNote(session!.id!, 'Market walk, sunny');
    expect(progress.recent.find((e) => e.id === session!.id)?.note).toBe('Market walk, sunny');
    progress = await api.deleteEntry(session!.id!);
    expect(progress).toMatchObject({ outdoorMinutes: 14, sessionsLogged: 0 });

    expect((await api.getProgress()).recent[0]).toMatchObject({ title: 'Cloud spotter', note: 'Fast clouds' });
    expect((await api.getQuests()).find((q) => q.id === 'cloud-spotter')?.status).toBe('completed');
  });

  it('a different browser profile starts from zero', async () => {
    window.localStorage.setItem('touchgrass.profile', `other-${Date.now().toString(36)}-bbbb`);
    expect(await api.getProgress()).toMatchObject({ completedActivities: 0, outdoorMinutes: 0 });
  });

  it('errors reach the UI as readable messages', async () => {
    await expect(api.completeQuest('no-such-quest')).rejects.toMatchObject({ status: 404, message: 'That quest could not be found.' });
  });
});
