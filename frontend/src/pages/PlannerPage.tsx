import { LocateFixed, MapPin, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckChips, RadioChips } from '../components/ChoiceChips';
import { AiStatus } from '../components/AiStatus';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormField, errorId, hintId } from '../components/FormField';
import { BarrierChips } from '../components/quests/BarrierChips';
import { RelatedQuests } from '../components/quests/RelatedQuests';
import { Skeleton } from '../components/LoadingState';
import { PlanResult } from '../components/PlanResult';
import { SectionHeading } from '../components/SectionHeading';
import { useToast } from '../components/ToastProvider';
import {
  ACCESSIBILITY_CHOICES,
  BUDGET_CHOICES,
  COMPANY_CHOICES,
  ENERGY_CHOICES,
  INTEREST_IDS,
  INTEREST_META,
  TIME_CHOICES,
} from '../data/options';
import { BARRIER_BY_ID, BARRIERS, WEATHER_NOTE } from '../data/barriers';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import type {
  AccessibilityNeed,
  ActivityPlan,
  BarrierId,
  Budget,
  Company,
  Energy,
  Interest,
  PlanPreferences,
  TimeOption,
} from '../types';
import { isTimeOption } from '../utils/format';

interface FormState {
  barriers: BarrierId[];
  minutes: TimeOption;
  budget: Budget;
  energy: Energy;
  interests: Interest[];
  company: Company;
  accessibility: AccessibilityNeed[];
  notes: string;
  locationLabel: string;
  coords: { lat: number; lon: number } | null;
}

interface FormErrors {
  interests?: string;
  notes?: string;
  locationLabel?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const NOTES_MAX = 300;
const LOCATION_MAX = 80;

const INTEREST_OPTIONS = INTEREST_IDS.map((id) => ({
  value: id,
  label: INTEREST_META[id].label,
  icon: INTEREST_META[id].icon,
}));

const BARRIER_IDS = BARRIERS.map((b) => b.id) as string[];

/** Choosing a barrier sets the matching answers. Only newly chosen barriers change anything, and every answer stays editable. */
function applyBarriers(form: FormState, added: BarrierId[]): FormState {
  const next: FormState = { ...form, accessibility: [...form.accessibility] };
  const addAccess = (need: AccessibilityNeed) => {
    if (!next.accessibility.includes(need)) next.accessibility.push(need);
  };
  for (const id of added) {
    if (id === 'short-time' && next.minutes > 20) next.minutes = 20;
    if (id === 'no-budget') next.budget = 'free';
    if (id === 'low-energy') next.energy = 'low';
    if (id === 'solo') next.company = 'solo';
    if (id === 'accessible') {
      addAccess('step-free');
      next.energy = 'low';
    }
    if (id === 'near-home') addAccess('short-distance');
    if (id === 'quiet') addAccess('low-sensory');
  }
  return next;
}

function initialState(params: URLSearchParams): FormState {
  const minutes = Number(params.get('minutes'));
  const energy = params.get('energy');
  const interests = (params.get('interests') ?? '')
    .split(',')
    .filter((value): value is Interest => (INTEREST_IDS as string[]).includes(value));

  const barriers = (params.get('barriers') ?? '')
    .split(',')
    .filter((value): value is BarrierId => BARRIER_IDS.includes(value));

  const base: FormState = {
    barriers,
    minutes: isTimeOption(minutes) ? minutes : 30,
    budget: 'free',
    energy: energy === 'low' || energy === 'medium' || energy === 'high' ? energy : 'medium',
    interests,
    company: 'solo',
    accessibility: [],
    notes: '',
    locationLabel: '',
    coords: null,
  };
  return applyBarriers(base, barriers);
}

function notesLimit(form: FormState): number {
  return form.barriers.includes('bad-weather') ? NOTES_MAX - WEATHER_NOTE.length - 1 : NOTES_MAX;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.interests.length === 0) errors.interests = 'Choose at least one interest so the plan can match you.';
  if (form.notes.length > notesLimit(form)) errors.notes = `Keep this under ${notesLimit(form)} characters.`;
  if (form.locationLabel.length > LOCATION_MAX) errors.locationLabel = `Keep this under ${LOCATION_MAX} characters.`;
  return errors;
}

function toPreferences(form: FormState): PlanPreferences {
  const area = form.locationLabel.trim();
  const hasLocation = area.length > 0 || form.coords !== null;
  return {
    minutes: form.minutes,
    budget: form.budget,
    energy: form.energy,
    interests: form.interests,
    company: form.company,
    accessibility: form.accessibility,
    // The planner has no weather field, so poor weather travels as a short note. Everything else is structured.
    notes: [form.barriers.includes('bad-weather') ? WEATHER_NOTE : '', form.notes.trim()].filter(Boolean).join(' ') || undefined,
    location: hasLocation
      ? { label: area || undefined, lat: form.coords?.lat, lon: form.coords?.lon }
      : undefined,
  };
}

const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

/** After a few seconds, explain why it is slow instead of leaving people guessing. */
function SlowHint() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (api.source === 'mock') return null;
  return (
    <p className="text-sm text-forest-600">
      {seconds < 6
        ? 'Asking the local AI model.'
        : `Still working (${seconds}s). A local open-weight model can take a minute, especially the first time it loads. If it cannot finish, you will get a labelled fallback plan.`}
    </p>
  );
}

export function PlannerPage() {
  useDocumentTitle('Activity planner', 'Tell TouchGrass your time, budget, energy and interests and get a realistic outdoor plan with a backup option.');
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(() => initialState(searchParams));
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [plan, setPlan] = useState<ActivityPlan | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const lastPrefs = useRef<PlanPreferences | null>(null);
  const lastBarriers = useRef<BarrierId[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { notify } = useToast();

  useEffect(() => {
    if (status === 'loading' && window.innerWidth < 1024) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key === 'interests' || key === 'notes' || key === 'locationLabel') {
      setErrors((previous) => ({ ...previous, [key]: undefined }));
    }
  }

  async function runPlan(preferences: PlanPreferences) {
    lastPrefs.current = preferences;
    lastBarriers.current = form.barriers;
    setStatus('loading');
    setRequestError(null);
    try {
      const result = await api.createPlan(preferences);
      setPlan(result);
      setStatus('success');
      notify(
        result.source === 'fallback'
          ? 'Your plan is ready. The AI was not available, so this is a built-in fallback plan.'
          : 'Your plan is ready.',
        result.source === 'fallback' ? 'info' : 'success',
      );
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'We could not build your plan.');
      setStatus('error');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      window.setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    void runPlan(toPreferences(form));
  }

  function changeBarriers(values: BarrierId[]) {
    const added = values.filter((id) => !form.barriers.includes(id));
    setForm((previous) => applyBarriers({ ...previous, barriers: values }, added));
    setErrors((previous) => ({ ...previous, notes: undefined }));
  }

  function requestLocation() {
    if (!('geolocation' in navigator)) {
      notify('This browser cannot share location. You can type an area instead.', 'info');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update('coords', {
          lat: roundCoordinate(position.coords.latitude),
          lon: roundCoordinate(position.coords.longitude),
        });
        setLocating(false);
        notify('Using an approximate location, rounded to about 1 km.', 'info');
      },
      () => {
        setLocating(false);
        notify('Location was not shared. That is fine. You can type an area or leave it blank.', 'info');
      },
      { timeout: 8000, maximumAge: 600_000 },
    );
  }

  function reset() {
    setPlan(null);
    setStatus('idle');
    setRequestError(null);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="container-page py-12 lg:py-16">
      <SectionHeading
        as="h1"
        title="Plan my next adventure"
        description="Answer a few questions and get one realistic plan with a checklist and a backup. Everything except your interests is adjustable, and nothing here needs your exact location."
      />

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <form onSubmit={handleSubmit} noValidate className="space-y-8 rounded-3xl bg-white p-6 shadow-card sm:p-8" aria-label="Activity preferences">
          {errorCount > 0 && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="rounded-2xl border border-ember-600/40 bg-ember-100/60 p-4 text-sm text-forest-900 outline-none"
            >
              <p className="font-semibold">Please fix {errorCount === 1 ? 'one thing' : `${errorCount} things`} before planning:</p>
              <ul className="mt-1 list-disc pl-5">
                {errors.interests && <li>{errors.interests}</li>}
                {errors.notes && <li>{errors.notes}</li>}
                {errors.locationLabel && <li>{errors.locationLabel}</li>}
              </ul>
            </div>
          )}

          <FormField
            id="barriers"
            legend
            label="Anything in the way today?"
            optional
            hint="Pick whatever is true. It sets the answers below, which you can still change. Nothing here is a judgement."
          >
            <BarrierChips name="barriers" values={form.barriers} onChange={changeBarriers} describedBy={hintId('barriers')} />
            {form.barriers.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-forest-700">
                {form.barriers.map((id) => (
                  <li key={id}>
                    {BARRIER_BY_ID[id].label}: {BARRIER_BY_ID[id].effect}
                  </li>
                ))}
              </ul>
            )}
          </FormField>

          <FormField id="time" legend label="How much time do you have?">
            <RadioChips name="time" options={TIME_CHOICES} value={form.minutes} onChange={(value) => update('minutes', value)} />
          </FormField>

          <FormField id="budget" legend label="What is your budget?">
            <RadioChips name="budget" options={BUDGET_CHOICES} value={form.budget} onChange={(value) => update('budget', value)} />
          </FormField>

          <FormField id="energy" legend label="How is your energy?">
            <RadioChips name="energy" options={ENERGY_CHOICES} value={form.energy} onChange={(value) => update('energy', value)} />
          </FormField>

          <FormField id="interests" legend label="What are you into?" hint="Pick all that apply." error={errors.interests}>
            <CheckChips
              name="interests"
              options={INTEREST_OPTIONS}
              values={form.interests}
              onChange={(values) => update('interests', values)}
              invalid={Boolean(errors.interests)}
              describedBy={errors.interests ? errorId('interests') : hintId('interests')}
            />
          </FormField>

          <FormField id="company" legend label="Who is coming?">
            <RadioChips name="company" options={COMPANY_CHOICES} value={form.company} onChange={(value) => update('company', value)} />
          </FormField>

          <FormField
            id="access"
            legend
            label="Accessibility and mobility"
            optional
            hint="Plans only include activities tagged for everything you select."
          >
            <CheckChips
              name="access"
              options={ACCESSIBILITY_CHOICES}
              values={form.accessibility}
              onChange={(values) => update('accessibility', values)}
              describedBy={hintId('access')}
            />
          </FormField>

          <FormField id="notes" label="Anything else we should know?" optional error={errors.notes}>
            <textarea
              id="notes"
              className="input min-h-24 resize-y"
              rows={3}
              value={form.notes}
              maxLength={notesLimit(form) + 50}
              onChange={(event) => update('notes', event.target.value)}
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? errorId('notes') : undefined}
              placeholder="For example: I use a cane, or I get overwhelmed by crowds."
            />
            <p className="mt-1 text-right text-xs text-forest-600">
              {form.notes.length}/{notesLimit(form)}
            </p>
          </FormField>

          <FormField
            id="location"
            label="Area"
            optional
            hint="A city or neighbourhood is enough. Never your address."
            error={errors.locationLabel}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-500" aria-hidden="true" />
                <input
                  id="location"
                  type="text"
                  className="input pl-10"
                  value={form.locationLabel}
                  onChange={(event) => update('locationLabel', event.target.value)}
                  autoComplete="off"
                  placeholder="e.g. Bhubaneswar"
                  aria-invalid={Boolean(errors.locationLabel)}
                  aria-describedby={[hintId('location'), errors.locationLabel ? errorId('location') : '']
                    .filter(Boolean)
                    .join(' ')}
                />
              </div>
              <Button variant="secondary" onClick={requestLocation} loading={locating} disabled={form.coords !== null}>
                {!locating && <LocateFixed className="h-4 w-4" aria-hidden="true" />}
                Use approximate location
              </Button>
            </div>
            {form.coords && (
              <p className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sage-100 px-3 py-2 text-sm text-forest-800">
                <span>Approximate area selected (rounded to about 1 km).</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                  onClick={() => update('coords', null)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </button>
              </p>
            )}
            {api.source === 'mock' && (
              <p className="mt-2 text-xs text-forest-600">Demo mode ignores location. It will be used once the backend is connected.</p>
            )}
          </FormField>

          <AiStatus />

          <Button type="submit" variant="accent" size="lg" className="w-full" loading={status === 'loading'}>
            {status === 'loading' ? 'Building your plan' : 'Build my plan'}
          </Button>
        </form>

        <div ref={resultsRef} className="lg:sticky lg:top-24" aria-live="polite">
          {status === 'idle' && (
            <EmptyState
              icon={Sparkles}
              title="Your plan will appear here"
              description="Choose your time, budget, energy and interests, then build your plan. You will get a checklist, an estimated cost and a backup."
            />
          )}
          {status === 'loading' && (
            <div role="status" className="space-y-4 rounded-3xl bg-white p-8 shadow-card">
              <p className="font-display text-2xl text-forest-900">Matching your time, energy and interests</p>
              <SlowHint />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="mt-6 h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {status === 'error' && (
            <ErrorMessage
              title="We could not build your plan"
              message={requestError ?? 'Please try again in a moment.'}
              onRetry={lastPrefs.current ? () => void runPlan(lastPrefs.current as PlanPreferences) : undefined}
            />
          )}
          {status === 'success' && plan && <PlanResult plan={plan} onReset={reset} />}
        </div>
      </div>

      {status === 'success' && plan && lastPrefs.current && (
        <RelatedQuests preferences={lastPrefs.current} barriers={lastBarriers.current} />
      )}
    </div>
  );
}
