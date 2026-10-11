import { describe, expect, it } from 'vitest';
import { ResponseShapeError, parseActivities, parseHealth, parsePlanResponse } from './validators';

const planBody = (overrides: Record<string, unknown> = {}) => ({
  generated_by: 'ai',
  model: 'gemma3:4b',
  fallback_reason: null,
  message: null,
  plan: {
    id: 'plan-1',
    generated_by: 'ai',
    model: 'gemma3:4b',
    generated_at: '2026-10-10T09:00:00Z',
    title: 'Golden-hour park loop',
    summary: 'A slow loop through the park.',
    why_it_matches: 'Fits an hour and a small budget.',
    total_minutes: 45,
    steps: [
      { order: 1, title: 'Walk', description: 'Walk calmly.', duration_minutes: 10 },
      { order: 2, title: 'Photograph', description: 'Five photos.', duration_minutes: 20 },
    ],
    estimated_cost: { min: 0, max: 3, currency: 'USD', assumptions: 'Bring water from home.' },
    difficulty: 'easy',
    energy_required: 'low',
    checklist: ['Water bottle', 'Comfortable shoes'],
    challenge: 'Find five greens.',
    accessibility_adaptations: ['Use benches.'],
    backup_plan: { title: 'Window sky watch', description: 'Watch clouds.', duration_minutes: 10, when_to_use: 'If it rains.' },
    safety_reminders: ['Tell someone.'],
    phone_away_suggestion: 'Keep the phone pocketed.',
  },
  ...overrides,
});

describe('parsePlanResponse', () => {
  it('maps an AI plan to the frontend type and keeps the model name', () => {
    const plan = parsePlanResponse(planBody());
    expect(plan).toMatchObject({
      id: 'plan-1', source: 'ai', model: 'gemma3:4b', durationMinutes: 45, reason: 'Fits an hour and a small budget.',
      estimatedCost: { min: 0, max: 3, currency: 'USD' }, challenge: 'Find five greens.', costAssumptions: 'Bring water from home.',
      backup: { title: 'Window sky watch', summary: 'Watch clouds.', durationMinutes: 10, whenToUse: 'If it rains.' },
      safetyReminders: ['Tell someone.'], accessibilityAdaptations: ['Use benches.'], phoneAwaySuggestion: 'Keep the phone pocketed.',
    });
    expect(plan.checklist.map((c) => c.label)).toEqual(['Water bottle', 'Comfortable shoes']);
    expect(new Set(plan.checklist.map((c) => c.id)).size).toBe(2);
    expect(plan.steps).toHaveLength(2);
    expect(plan.notice).toBeUndefined();
  });

  it('labels a fallback as fallback, drops the model, and carries the explanation', () => {
    const plan = parsePlanResponse(
      planBody({ generated_by: 'fallback', model: null, fallback_reason: 'ai_unreachable', message: 'The AI service is not running, so this plan was built from the catalogue.' }),
    );
    expect(plan.source).toBe('fallback');
    expect(plan.model).toBeUndefined();
    expect(plan.fallbackReason).toBe('ai_unreachable');
    expect(plan.notice).toMatch(/not running/);
  });

  it('never presents a fallback without a notice', () => {
    expect(parsePlanResponse(planBody({ generated_by: 'fallback', model: null, message: null })).notice).toBeTruthy();
  });

  it('rejects malformed plans instead of rendering half of one', () => {
    for (const bad of [null, {}, { plan: null }, planBody({ generated_by: 'human' }), planBody({ plan: { id: 'x' } })]) {
      expect(() => parsePlanResponse(bad)).toThrow(ResponseShapeError);
    }
    const noSteps = planBody();
    (noSteps.plan as { steps: unknown[] }).steps = [];
    expect(() => parsePlanResponse(noSteps)).toThrow(ResponseShapeError);
  });
});

describe('parseActivities', () => {
  const item = {
    id: 'park-picnic', title: 'Simple park picnic', description: 'Share a picnic.', category: 'social', interests: ['social', 'nature'],
    duration_minutes: 60, budget: 'low', estimated_cost: { min: 0, max: 8, currency: 'USD' }, difficulty: 'easy', energy_required: 'low',
    accessibility: ['seating'], suitable_for: ['friends', 'family'], steps: ['Pick a spot'], checklist: ['Blanket'], tips: ['Bring a bag'], challenge: null,
  };

  it('converts the envelope and snake_case fields', () => {
    const [a] = parseActivities({ items: [item], count: 1 });
    expect(a).toMatchObject({
      id: 'park-picnic', summary: 'Share a picnic.', minutes: 60, energy: 'low', company: ['friends', 'family'],
      cost: { min: 0, max: 8, currency: 'USD' }, type: 'Social activities', checklist: ['Blanket'], tips: ['Bring a bag'], steps: ['Pick a spot'],
    });
    expect(a.challenge).toBeUndefined();
  });

  it('skips broken items and rejects a non-envelope', () => {
    expect(parseActivities({ items: [item, { id: 'x' }, 'junk', { ...item, interests: [] }], count: 4 })).toHaveLength(1);
    expect(() => parseActivities([item])).toThrow(ResponseShapeError);
  });
});

describe('parseHealth', () => {
  it('reads ok and degraded states with the setup hint', () => {
    expect(parseHealth({ status: 'ok', ai: { status: 'ready', model: 'gemma3:4b', setup_hint: null } })).toEqual({
      status: 'ok', ai: { status: 'ready', model: 'gemma3:4b', setupHint: undefined },
    });
    expect(parseHealth({ status: 'degraded', ai: { status: 'model_missing', model: 'gemma3:4b', setup_hint: 'Run: ollama pull gemma3:4b' } }).ai)
      .toMatchObject({ status: 'model_missing', setupHint: 'Run: ollama pull gemma3:4b' });
  });
  it('rejects unknown statuses', () => {
    expect(() => parseHealth({ status: 'fine' })).toThrow(ResponseShapeError);
    expect(() => parseHealth(null)).toThrow(ResponseShapeError);
  });
});
