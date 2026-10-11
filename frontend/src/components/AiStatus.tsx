import { Bot, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { HealthStatus } from '../types';
import { cn } from '../utils/cn';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; health: HealthStatus };

const REASONS: Record<string, string> = {
  model_missing: 'The AI model has not been downloaded yet.',
  unreachable: 'The AI service (Ollama) is not running.',
  disabled: 'The AI is switched off on this server.',
};

/**
 * Tells the person, before they submit, whether the plan will come from the AI model or from the labelled fallback.
 * It reads GET /api/health, which never exposes URLs, paths or secrets.
 */
export function AiStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    api
      .health(controller.signal)
      .then((health) => setState({ kind: 'ok', health }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not check the AI service.' });
      });
    return () => controller.abort();
  }, [attempt]);

  let tone = 'border-forest-800/15 bg-cream-50';
  let text: string;
  let hint: string | undefined;

  if (api.source === 'mock') {
    text = 'Demo mode: plans come from simple rules in your browser, not from an AI model.';
  } else if (state.kind === 'loading') {
    text = 'Checking whether the AI model is ready';
  } else if (state.kind === 'error') {
    tone = 'border-ember-600/40 bg-ember-100/60';
    text = 'Could not reach the TouchGrass server, so a plan cannot be built right now.';
    hint = state.message;
  } else if (state.health.status === 'error') {
    tone = 'border-ember-600/40 bg-ember-100/60';
    text = 'The server has a problem with its database. Plans may not save, try again shortly.';
  } else if (state.health.ai?.status === 'ready') {
    tone = 'border-sage-300 bg-sage-100';
    text = `AI ready: ${state.health.ai.model}. Your plan will be written by this open-weight model. The first one can take a minute while it loads.`;
  } else {
    tone = 'border-ember-600/40 bg-ember-100/60';
    const status = state.health.ai?.status ?? 'unreachable';
    text = `${REASONS[status] ?? 'The AI is not ready.'} You will still get a plan from the built-in fallback, and it will be labelled as not AI.`;
    hint = state.health.ai?.setupHint;
  }

  return (
    <div role="status" aria-live="polite" className={cn('flex items-start gap-3 rounded-2xl border p-4 text-sm text-forest-900', tone)}>
      <Bot className="mt-0.5 h-5 w-5 shrink-0 text-forest-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>{text}</p>
        {hint && <p className="mt-1 break-words text-forest-700">{hint}</p>}
      </div>
      {api.source !== 'mock' && state.kind !== 'loading' && (
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-forest-800/10"
          aria-label="Check the AI status again"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
