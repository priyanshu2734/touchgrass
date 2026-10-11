import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ApiModule = typeof import('./api');

async function loadApi(): Promise<ApiModule> {
  vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
  vi.resetModules();
  return import('./api');
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const goodPlace = { id: 'osm:way/1', name: 'Test Park', category: 'Park', lat: 20.3, lon: 85.8, distanceMeters: 420 };

describe('getPlaces', () => {
  it('uses the existing contract and sends only what is needed', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json([goodPlace]));
    const places = await api.getPlaces(20.296, 85.824, 2000, { categories: ['park', 'garden'] });
    expect(places).toHaveLength(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('http://api.test/api/places');
    expect(url.searchParams.get('lat')).toBe('20.296');
    expect(url.searchParams.get('radius')).toBe('2000');
    expect(url.searchParams.get('categories')).toBe('park,garden');
  });

  it('drops invalid places instead of rendering them', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(
      json([
        goodPlace,
        { ...goodPlace, id: 'bad-lat', lat: 999 },
        { ...goodPlace, id: 'no-name', name: '' },
        { ...goodPlace, id: 'bad-site', website: 'javascript:alert(1)', osmUrl: 'https://www.openstreetmap.org/way/2', wheelchair: 'maybe' },
        'junk',
      ]),
    );
    const places = await api.getPlaces(1, 1, 1000);
    expect(places.map((p) => p.id)).toEqual(['osm:way/1', 'bad-site']);
    expect(places[1].website).toBeUndefined();
    expect(places[1].wheelchair).toBeUndefined();
    expect(places[1].osmUrl).toBe('https://www.openstreetmap.org/way/2');
  });

  it('turns a wrongly shaped response into a readable error', async () => {
    const { api, ApiError } = await loadApi();
    fetchMock.mockImplementation(() => Promise.resolve(json({ places: [] })));
    await expect(api.getPlaces(1, 1, 1000)).rejects.toThrowError(ApiError);
    await expect(api.getPlaces(1, 1, 1000)).rejects.toThrow(/format we did not expect/);
  });

  it('returns an empty list for no results', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json([]));
    expect(await api.getPlaces(1, 1, 1000)).toEqual([]);
  });
});

describe('error handling', () => {
  it('shows the backend detail message', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json({ detail: 'The map data service is busy right now.' }, 429));
    await expect(api.getPlaces(1, 1, 1000)).rejects.toMatchObject({ message: 'The map data service is busy right now.', status: 429 });
  });

  it.each([
    [429, /Too many requests/],
    [503, /unavailable/],
    [504, /took too long/],
    [404, /could not find/],
    [500, /error \(500\)/],
  ])('has a plain message for %s without a detail', async (status, pattern) => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status }));
    await expect(api.getQuests()).rejects.toThrow(pattern);
  });

  it('reports an unreachable server', async () => {
    const { api } = await loadApi();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.getProgress()).rejects.toThrow(/Could not reach the TouchGrass server/);
  });

  it('reports a body that is not JSON', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(api.getProgress()).rejects.toThrow(/could not read/);
  });

  it('times out slow requests', async () => {
    vi.useFakeTimers();
    const { api } = await loadApi();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = api.getPlaces(1, 1, 1000).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(40_001);
    const error = (await pending) as Error & { aborted: boolean };
    expect(error.message).toMatch(/took too long/);
    expect(error.aborted).toBe(false);
  });

  it('marks caller cancellations so the UI can ignore them', async () => {
    const { api } = await loadApi();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const controller = new AbortController();
    const pending = api.getPlaces(1, 1, 1000, { signal: controller.signal }).catch((e: Error) => e);
    controller.abort();
    expect(await pending).toMatchObject({ aborted: true });
  });
});

describe('geocode', () => {
  it('validates results', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json([{ label: 'Puri, Odisha', lat: 19.8, lon: 85.8 }, { label: 'Nowhere', lat: 500, lon: 1 }, { lat: 1, lon: 1 }]));
    expect(await api.geocode('Puri')).toEqual([{ label: 'Puri, Odisha', lat: 19.8, lon: 85.8 }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://api.test/api/geocode?q=Puri');
  });
});

describe('quests and progress', () => {
  const quest = {
    id: 'cloud-spotter', title: 'Cloud spotter', summary: 'Watch the sky.', category: 'nature-observation', difficulty: 'easy',
    minutes: 10, steps: ['Look up'], status: 'completed', completedAt: '2026-10-10T09:00:00Z', completionCount: 1,
  };
  const progress = { completedActivities: 1, outdoorMinutes: 14, currentStreak: 1, longestStreak: 1, milestones: [], recent: [] };

  it('completeQuest without input is the Part 1 call, plus the client date for streaks', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json({ quest, progress }));
    const result = await api.completeQuest('cloud-spotter');
    expect(result.quest.status).toBe('completed');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/quests\/cloud-spotter\/complete\?today=\d{4}-\d{2}-\d{2}$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sends minutes, reflection and repeat when given', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json({ quest, progress }));
    await api.completeQuest('cloud-spotter', { minutesSpent: 14, reflection: 'Windy', repeat: true });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ minutesSpent: 14, reflection: 'Windy', repeat: true });
  });

  it('surfaces a failed completion so the UI can offer a retry', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json({ detail: 'That quest could not be found.' }, 404));
    await expect(api.completeQuest('nope')).rejects.toMatchObject({ status: 404, message: 'That quest could not be found.' });
  });

  it('rejects a completion response without a valid quest', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json({ quest: { id: 'x' }, progress }));
    await expect(api.completeQuest('x')).rejects.toThrow(/format we did not expect/);
  });

  it('accepts an older backend that lacks Part 3 quest fields', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json([quest, { id: 'junk' }]));
    const quests = await api.getQuests();
    expect(quests).toHaveLength(1);
    expect(quests[0].equipment).toBeUndefined();
  });

  it('getProgress passes the local date and validates', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json({ ...progress, activeDates: ['2026-10-10'], recent: [{ questId: 'q', title: 'T', completedAt: 'x', minutes: 5, id: '7', kind: 'session' }, { bad: true }] }));
    const result = await api.getProgress();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/progress\?today=\d{4}-\d{2}-\d{2}$/);
    expect(result.recent).toHaveLength(1);
    await expect((async () => { fetchMock.mockResolvedValue(json({ nope: 1 })); return api.getProgress(); })()).rejects.toThrow(/format we did not expect/);
  });

  it('entry endpoints use PATCH and DELETE', async () => {
    const { api } = await loadApi();
    fetchMock.mockImplementation(() => Promise.resolve(json(progress)));
    await api.updateEntryNote('7', 'hello');
    await api.deleteEntry('7');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PATCH');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('DELETE');
  });
});


describe('backend integration details', () => {
  it('sends the anonymous profile id on every request', async () => {
    const { api } = await loadApi();
    fetchMock.mockImplementation(() => Promise.resolve(json([])));
    window.localStorage.setItem('touchgrass.profile', 'profile-test-1234');
    await api.getPlaces(1, 1, 1000);
    await api.getQuests();
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).headers).toMatchObject({ 'X-Profile-Id': 'profile-test-1234' });
    }
  });

  it('shows the message from the backend error format { error: { code, message } }', async () => {
    const { api } = await loadApi();
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ error: { code: 'rate_limited', message: 'Too many searches in a short time.' } }, 429)),
    );
    await expect(api.getPlaces(1, 1, 1000)).rejects.toMatchObject({ status: 429, message: 'Too many searches in a short time.' });
  });

  it('createPlan posts the preferences, waits long enough for a local model, and maps the Part 2 response', async () => {
    vi.useFakeTimers();
    const { api, PLAN_TIMEOUT_MS } = await loadApi();
    expect(PLAN_TIMEOUT_MS).toBeGreaterThanOrEqual(130_000);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({
          generated_by: 'fallback', model: null, fallback_reason: 'ai_unreachable', message: 'The AI service is not running.',
          plan: {
            id: 'p1', generated_by: 'fallback', model: null, generated_at: '2026-10-10T09:00:00Z', title: 'Doorstep reset', summary: 'Ten minutes outside.',
            why_it_matches: 'Fits.', total_minutes: 10, steps: [{ order: 1, title: 'Step out', description: 'Go.', duration_minutes: 10 }],
            estimated_cost: { min: 0, max: 0, currency: 'USD', assumptions: 'Free.' }, difficulty: 'easy', energy_required: 'low', checklist: ['Shoes'],
            challenge: null, accessibility_adaptations: [], backup_plan: { title: 'Window', description: 'Look out.', duration_minutes: 5, when_to_use: 'Rain' },
            safety_reminders: [], phone_away_suggestion: 'Pocket it.',
          },
        }),
      ),
    );
    const prefs = { minutes: 10, budget: 'free', energy: 'low', interests: ['nature'], company: 'solo', accessibility: [] } as const;
    const plan = await api.createPlan({ ...prefs, interests: ['nature'], accessibility: [] });
    expect(plan).toMatchObject({ source: 'fallback', notice: 'The AI service is not running.' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/plan');
    expect(JSON.parse(init.body as string)).toMatchObject({ minutes: 10, budget: 'free', interests: ['nature'] });
  });

  it('getActivities reads the { items, count } envelope', async () => {
    const { api } = await loadApi();
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ items: [{ id: 'a', title: 'T', description: 'D', category: 'nature', interests: ['nature'], duration_minutes: 20,
        budget: 'free', estimated_cost: { min: 0, max: 0, currency: 'USD' }, difficulty: 'easy', energy_required: 'low', accessibility: [],
        suitable_for: ['solo'], steps: [], checklist: [], tips: [], challenge: null }], count: 1 })),
    );
    expect((await api.getActivities())[0]).toMatchObject({ id: 'a', minutes: 20, summary: 'D' });
  });

  it('health reports the AI state', async () => {
    const { api } = await loadApi();
    fetchMock.mockImplementation(() => Promise.resolve(json({ status: 'degraded', ai: { status: 'unreachable', model: 'gemma3:4b', setup_hint: 'Start Ollama' } })));
    expect(await api.health()).toMatchObject({ status: 'degraded', ai: { status: 'unreachable', setupHint: 'Start Ollama' } });
  });

  it('uses the real backend unless VITE_USE_MOCK=true', async () => {
    vi.stubEnv('VITE_USE_MOCK', '');
    vi.resetModules();
    expect((await import('./config')).USE_MOCK).toBe(false);
    vi.stubEnv('VITE_USE_MOCK', 'true');
    vi.resetModules();
    expect((await import('./config')).USE_MOCK).toBe(true);
  });
});
