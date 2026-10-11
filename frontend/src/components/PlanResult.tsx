import { Check, ClipboardCopy, Clock, Flag, Info, PhoneOff, RotateCcw, ShieldCheck, Sparkles, Umbrella, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ActivityPlan } from '../types';
import { formatCost, formatDuration, hashString } from '../utils/format';
import { Badge } from './Badge';
import { Button, ButtonLink } from './Button';
import { ContourArt } from './ContourArt';
import { useToast } from './ToastProvider';
import { cn } from '../utils/cn';

export function sourceLabel(plan: Pick<ActivityPlan, 'source' | 'model'>): string {
  if (plan.source === 'mock') return 'Demo plan from simple rules in your browser, not AI';
  if (plan.source === 'fallback') return 'Built-in fallback plan, not AI';
  return plan.model ? `AI-generated with ${plan.model}` : 'AI-generated';
}

function SourceBadge({ plan }: { plan: ActivityPlan }) {
  return <Badge tone={plan.source === 'ai' ? 'sage' : 'ember'}>{sourceLabel(plan)}</Badge>;
}

function planToText(plan: ActivityPlan): string {
  const lines = [
    `${plan.title} (${formatDuration(plan.durationMinutes)}, ${formatCost(plan.estimatedCost)})`,
    sourceLabel(plan),
    plan.summary,
    '',
    ...(plan.steps?.length ? ['Steps:', ...plan.steps.map((s) => `${s.order}. ${s.title} (${formatDuration(s.durationMinutes)}): ${s.description}`), ''] : []),
    'Checklist:',
    ...plan.checklist.map((item) => `- ${item.label}`),
    '',
    `Backup: ${plan.backup.title} (${formatDuration(plan.backup.durationMinutes)}). ${plan.backup.summary}`,
    '',
    'Planned with TouchGrass',
  ];
  return lines.join('\n');
}

interface PlanResultProps {
  plan: ActivityPlan;
  onReset: () => void;
}

export function PlanResult({ plan, onReset }: PlanResultProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const { notify } = useToast();

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    setChecked({});
  }, [plan.id]);

  const doneCount = plan.checklist.filter((item) => checked[item.id]).length;

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(planToText(plan));
      notify('Plan copied. Paste it into a note or message.', 'success');
    } catch {
      notify('Could not copy automatically. Select the text on the page and copy it manually.', 'error');
    }
  }

  return (
    <article aria-labelledby="plan-title" className="overflow-hidden rounded-3xl bg-white shadow-lift">
      <header className="relative overflow-hidden bg-forest-800 px-6 pb-7 pt-8 text-cream-50 sm:px-9">
        <ContourArt seed={hashString(plan.id)} tone="forest" rings={12} className="absolute inset-0 h-full w-full" />
        <div className="relative">
          <SourceBadge plan={plan} />
          <h2 id="plan-title" ref={headingRef} tabIndex={-1} className="mt-4 text-3xl font-medium text-cream-50 outline-none sm:text-4xl">
            {plan.title}
          </h2>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-cream-200">{plan.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="neutral" icon={Clock}>
              {formatDuration(plan.durationMinutes)}
            </Badge>
            <Badge tone="neutral" icon={Wallet}>
              Estimated cost: {formatCost(plan.estimatedCost)}
            </Badge>
          </div>
        </div>
      </header>

      <div className="space-y-8 px-6 py-8 sm:px-9">
        {plan.notice && (
          <p role="note" className="flex items-start gap-3 rounded-2xl border border-ember-600/40 bg-ember-100/60 p-4 text-forest-900">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-ember-700" aria-hidden="true" />
            <span>
              <strong className="font-semibold">This plan was not written by the AI. </strong>
              {plan.notice}
            </span>
          </p>
        )}

        {plan.reason && <p className="text-forest-700">{plan.reason}</p>}

        {plan.steps && plan.steps.length > 0 && (
          <section aria-labelledby="steps-heading">
            <h3 id="steps-heading" className="text-2xl font-medium">
              Your plan
            </h3>
            <ol className="mt-4 space-y-3">
              {plan.steps.map((step) => (
                <li key={step.order} className="flex gap-4 rounded-2xl bg-cream-50 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-100 font-semibold text-forest-800" aria-hidden="true">
                    {step.order}
                  </span>
                  <span>
                    <span className="block font-semibold text-forest-900">
                      <span className="sr-only">Step {step.order}: </span>
                      {step.title} <span className="font-normal text-forest-600">({formatDuration(step.durationMinutes)})</span>
                    </span>
                    <span className="mt-1 block text-forest-700">{step.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {plan.challenge && (
          <p className="flex items-start gap-3 rounded-2xl bg-sage-100 p-4 text-forest-900">
            <Flag className="mt-0.5 h-5 w-5 shrink-0 text-forest-600" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Optional challenge: </strong>
              {plan.challenge}
            </span>
          </p>
        )}

        <section aria-labelledby="checklist-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h3 id="checklist-heading" className="text-2xl font-medium">
              Before you go
            </h3>
            <p className="text-sm text-forest-600" aria-live="polite">
              {doneCount} of {plan.checklist.length} ready
            </p>
          </div>
          <ul className="mt-4 space-y-2">
            {plan.checklist.map((item) => {
              const isChecked = Boolean(checked[item.id]);
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember-500',
                      isChecked ? 'border-sage-300 bg-sage-100' : 'border-forest-800/15 bg-cream-50 hover:border-forest-800/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      onChange={() => setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2',
                        isChecked ? 'border-forest-800 bg-forest-800 text-cream-50' : 'border-forest-800/40 bg-white',
                      )}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className={cn(isChecked && 'text-forest-600 line-through')}>{item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {plan.tips.length > 0 && (
          <section aria-labelledby="tips-heading">
            <h3 id="tips-heading" className="text-2xl font-medium">
              Tips
            </h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-forest-700 marker:text-ember-600">
              {plan.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="backup-heading" className="rounded-2xl bg-cream-200/70 p-5">
          <h3 id="backup-heading" className="flex items-center gap-2 text-xl font-medium">
            <Umbrella className="h-5 w-5 text-ember-600" aria-hidden="true" />
            Backup option
          </h3>
          <p className="mt-2 font-semibold text-forest-900">
            {plan.backup.title} <span className="font-normal text-forest-600">({formatDuration(plan.backup.durationMinutes)})</span>
          </p>
          <p className="mt-1 text-forest-700">{plan.backup.summary}</p>
          {plan.backup.whenToUse && <p className="mt-2 text-sm text-forest-600">{plan.backup.whenToUse}</p>}
        </section>

        {plan.accessibilityAdaptations && plan.accessibilityAdaptations.length > 0 && (
          <section aria-labelledby="adapt-heading" className="rounded-2xl border border-forest-800/15 p-5">
            <h3 id="adapt-heading" className="text-xl font-medium">
              Adapted for your needs
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-forest-700 marker:text-ember-600">
              {plan.accessibilityAdaptations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {plan.safetyReminders && plan.safetyReminders.length > 0 && (
          <section aria-labelledby="safety-heading">
            <h3 id="safety-heading" className="flex items-center gap-2 text-xl font-medium">
              <ShieldCheck className="h-5 w-5 text-forest-600" aria-hidden="true" />
              Stay safe
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-forest-700 marker:text-ember-600">
              {plan.safetyReminders.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-forest-600">Plans are suggestions. Check the weather, the route and your own limits yourself.</p>
          </section>
        )}

        {plan.phoneAwaySuggestion && (
          <p className="flex items-start gap-3 text-forest-700">
            <PhoneOff className="mt-0.5 h-5 w-5 shrink-0 text-forest-500" aria-hidden="true" />
            {plan.phoneAwaySuggestion}
          </p>
        )}

        {plan.costAssumptions && <p className="text-sm text-forest-600">Cost note: {plan.costAssumptions}</p>}

        {plan.accessibilityNotes && (
          <p className="rounded-2xl border border-forest-800/15 p-4 text-sm text-forest-700">
            <strong className="font-semibold text-forest-900">Accessibility note: </strong>
            {plan.accessibilityNotes}
          </p>
        )}

        <div className="flex flex-wrap gap-3 border-t border-forest-800/10 pt-6">
          <Button variant="primary" onClick={copyPlan}>
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            Copy plan
          </Button>
          <ButtonLink to="/quests" variant="secondary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Try an outdoor quest
          </ButtonLink>
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Plan something else
          </Button>
        </div>
      </div>
    </article>
  );
}
