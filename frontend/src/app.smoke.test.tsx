/**
 * Renders every route of the real <App/> in jsdom against a mocked fetch, in the same shape the backend returns.
 * Fails on any console.error (React warnings, act problems, failed prop types) so runtime errors cannot hide.
 * This is not a visual test: layout and animation still need a real browser.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import quests from './data/quests.curated.json';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const activity = {
  id: 'park-picnic', title: 'Simple park picnic', description: 'Share a picnic.', category: 'social', interests: ['social', 'nature'],
  duration_minutes: 60, budget: 'low', estimated_cost: { min: 0, max: 8, currency: 'USD' }, difficulty: 'easy', energy_required: 'low',
  accessibility: ['seating'], suitable_for: ['friends'], steps: ['Pick a spot'], checklist: ['Blanket'], tips: ['Bring a bag'], challenge: null,
};
const progress = {
  completedActivities: 1, outdoorMinutes: 14, currentStreak: 1, longestStreak: 1, activeDays: 1, sessionsLogged: 0, plansGenerated: 2,
  activeDates: [new Date().toISOString().slice(0, 10)],
  milestones: [{ id: 'first-quest', title: 'First step', description: 'Complete your first quest.', target: 1, current: 1, unit: 'quests', achieved: true }],
  recent: [{ id: '1', kind: 'quest', questId: 'cloud-spotter', title: 'Cloud spotter', completedAt: '2026-10-10T09:00:00Z', localDate: '2026-10-10', minutes: 14, note: 'Windy' }],
};

function route(url: string): Response {
  const path = new URL(url).pathname;
  if (path === '/api/health') return json({ status: 'degraded', ai: { status: 'model_missing', model: 'gemma3:4b', setup_hint: 'Run: ollama pull gemma3:4b' } });
  if (path === '/api/activities') return json({ items: [activity, { ...activity, id: 'b' }, { ...activity, id: 'c' }, { ...activity, id: 'd' }, { ...activity, id: 'e' }, { ...activity, id: 'f' }], count: 6 });
  if (path === '/api/quests') return json(quests.map((q) => ({ ...q, status: 'available', origin: 'curated' })));
  if (path === '/api/progress') return json(progress);
  if (path === '/api/places/categories') return json([{ id: 'park', label: 'Park', defaultOn: true }]);
  return json({ error: { code: 'not_found', message: 'Not found' } }, 404);
}

let root: Root;
let container: HTMLDivElement;
let errors: unknown[][];

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(route(String(url)))));
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
  vi.resetModules();
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function renderAt(path: string): Promise<HTMLElement> {
  const { default: App } = await import('./App');
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
  });
  // let effects, fetches and state updates settle
  for (let i = 0; i < 6; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  return container;
}

const ROUTES: [string, RegExp][] = [
  ['/', /Less scrolling\. More living\./],
  ['/plan', /Plan my next adventure/],
  ['/explore', /Places to go outside/],
  ['/explore?view=ideas', /Activity ideas/],
  ['/quests', /What fits today\?/],
  ['/quests/cloud-spotter', /Cloud spotter/],
  ['/quests/not-a-quest', /could not find that quest/i],
  ['/progress', /My progress/],
  ['/about', /Privacy approach/],
  ['/nowhere', /./],
];

describe('every route renders without console errors', () => {
  it.each(ROUTES)('%s', async (path, expected) => {
    const el = await renderAt(path);
    expect(el.textContent).toMatch(expected);
    expect(errors, JSON.stringify(errors.map((e) => String(e[0]).slice(0, 200)))).toEqual([]);
  });
});

describe('what the person sees', () => {
  it('planner warns before submitting when the AI model is missing, and says the fallback is labelled', async () => {
    const el = await renderAt('/plan');
    expect(el.textContent).toMatch(/AI model has not been downloaded/);
    expect(el.textContent).toMatch(/built-in fallback/);
    expect(el.textContent).toMatch(/ollama pull gemma3:4b/);
  });

  it('explore asks for nothing until a button is pressed (no geolocation call, no places request)', async () => {
    const geo = { getCurrentPosition: vi.fn(), watchPosition: vi.fn() };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    const el = await renderAt('/explore');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(geo.watchPosition).not.toHaveBeenCalled();
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/places?'))).toBe(false);
    expect(el.textContent).toMatch(/Find places near me/);
  });

  it('quests page lists the curated catalogue and labels it as hand-written', async () => {
    const el = await renderAt('/quests');
    expect(el.textContent).toMatch(/curated/i);
    expect(el.textContent).toMatch(/None are generated by a model|none are generated by a model/i);
    expect(el.querySelectorAll('article').length).toBeGreaterThanOrEqual(quests.length);
  });

  it('progress shows only what the backend returned', async () => {
    const el = await renderAt('/progress');
    expect(el.textContent).toMatch(/Cloud spotter/);
    expect(el.textContent).toMatch(/Windy/);
    expect(el.textContent).toMatch(/built 2 plans/);
  });

  it('shows a recoverable error with a retry button when the backend is down', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const el = await renderAt('/quests');
    expect(el.textContent).toMatch(/Could not reach the TouchGrass server/);
    expect([...el.querySelectorAll('button')].some((b) => /try again|retry/i.test(b.textContent ?? ''))).toBe(true);
  });
});
