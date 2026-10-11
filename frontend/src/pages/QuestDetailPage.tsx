import { ArrowLeft, CheckCircle2, Clock, Compass, Gauge, Home, Lightbulb, MapPin, PlayCircle, Wallet, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button, ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingState, Skeleton } from '../components/LoadingState';
import { QuestCompleteModal } from '../components/quests/QuestCompleteModal';
import { useToast } from '../components/ToastProvider';
import { BUDGET_LABEL, DIFFICULTY_LABEL, ENERGY_LABEL, QUEST_CATEGORY_META } from '../data/options';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import type { CompleteQuestInput, Quest, TravelNeed } from '../types';
import { formatDate, formatDuration } from '../utils/format';
import { minutesAgo, suggestMinutes } from '../utils/questTime';

const TRAVEL_LABEL: Record<TravelNeed, string> = {
  doorstep: 'Starts at your door',
  nearby: 'A short walk away',
  'short-trip': 'Needs a short trip',
};

export function QuestDetailPage() {
  const { questId } = useParams<{ questId: string }>();
  const { data, error, loading, reload, setData } = useAsync(() => api.getQuests(), []);
  const [busy, setBusy] = useState<'start' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logging, setLogging] = useState<{ quest: Quest; repeat: boolean } | null>(null);
  const { notify } = useToast();

  const quest: Quest | undefined = data?.find((item) => item.id === questId);
  useDocumentTitle(quest ? quest.title : 'Quest', quest?.summary);

  function replace(updated: Quest) {
    if (data) setData(data.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function start(target: Quest) {
    setBusy('start');
    setActionError(null);
    try {
      replace(await api.startQuest(target.id));
      notify('Quest started. Come back and log it when you are done.', 'info');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'We could not start this quest.');
    } finally {
      setBusy(null);
    }
  }

  async function putBack(target: Quest) {
    setBusy('cancel');
    setActionError(null);
    try {
      replace(await api.cancelQuestStart(target.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'We could not update this quest.');
    } finally {
      setBusy(null);
    }
  }

  async function complete(target: Quest, input: CompleteQuestInput) {
    const response = await api.completeQuest(target.id, input); // errors surface inside the modal
    replace(response.quest);
    setLogging(null);
    notify(`Logged: ${target.title}`, 'success');
  }

  const suggestion = logging ? suggestMinutes(logging.quest) : { minutes: 0, fromStart: false };
  const startedAgo = minutesAgo(quest?.startedAt);

  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <Link to="/quests" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:text-forest-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All quests
      </Link>

      {loading && (
        <div className="mt-8 space-y-4">
          <LoadingState label="Loading quest" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {error && (
        <div className="mt-8">
          <ErrorMessage message={error} onRetry={reload} />
        </div>
      )}
      {data && !quest && (
        <div className="mt-8">
          <EmptyState icon={Compass} title="We could not find that quest" description="It may have been renamed or removed." action={<ButtonLink to="/quests">See all quests</ButtonLink>} />
        </div>
      )}

      {quest && (
        <article className="mt-8" aria-labelledby="quest-title">
          <p className="text-sm text-forest-600">
            {QUEST_CATEGORY_META[quest.category].label} · Curated quest
          </p>
          <h1 id="quest-title" className="mt-1 text-4xl font-medium sm:text-5xl">
            {quest.title}
          </h1>
          <p className="mt-4 text-xl leading-relaxed text-forest-700">{quest.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge icon={Gauge}>{DIFFICULTY_LABEL[quest.difficulty]}</Badge>
            <Badge icon={Clock}>{formatDuration(quest.minutes)}</Badge>
            {quest.budget && <Badge icon={Wallet}>{BUDGET_LABEL[quest.budget]}</Badge>}
            {quest.energy && <Badge icon={Zap}>{ENERGY_LABEL[quest.energy]}</Badge>}
            {quest.travel && <Badge icon={MapPin}>{TRAVEL_LABEL[quest.travel]}</Badge>}
            {quest.status === 'in-progress' && (
              <Badge tone="ember" icon={PlayCircle}>
                In progress
              </Badge>
            )}
            {quest.status === 'completed' && (
              <Badge tone="forest" icon={CheckCircle2}>
                Completed{quest.completedAt ? ` on ${formatDate(quest.completedAt)}` : ''}
                {quest.completionCount && quest.completionCount > 1 ? ` (${quest.completionCount} times)` : ''}
              </Badge>
            )}
          </div>

          {quest.objective && (
            <section className="mt-10" aria-labelledby="objective-heading">
              <h2 id="objective-heading" className="text-2xl font-medium">
                The aim
              </h2>
              <p className="mt-2 text-lg text-forest-700">{quest.objective}</p>
            </section>
          )}

          {quest.equipment && (
            <section className="mt-8" aria-labelledby="equipment-heading">
              <h2 id="equipment-heading" className="text-2xl font-medium">
                What you need
              </h2>
              {quest.equipment.length === 0 ? (
                <p className="mt-2 text-lg text-forest-700">Nothing. Just you.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {quest.equipment.map((item) => (
                    <li key={item} className="rounded-full bg-sage-100 px-3.5 py-1.5 text-[15px] text-forest-800">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="mt-10" aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="text-2xl font-medium">
              What to do
            </h2>
            <ol className="mt-4 space-y-3">
              {quest.steps.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-100 font-semibold text-forest-800" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {quest.completionCriteria && quest.completionCriteria.length > 0 && (
            <section className="mt-10" aria-labelledby="criteria-heading">
              <h2 id="criteria-heading" className="text-2xl font-medium">
                Count it as done when
              </h2>
              <ul className="mt-3 space-y-2">
                {quest.completionCriteria.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-lg text-forest-800">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-forest-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {quest.tip && (
            <p className="mt-8 flex items-start gap-3 rounded-2xl bg-cream-200/70 p-4 text-forest-800">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-ember-600" aria-hidden="true" />
              {quest.tip}
            </p>
          )}

          {quest.indoorFallback && (
            <section className="mt-8 rounded-2xl border border-forest-800/15 bg-cream-50 p-5" aria-labelledby="fallback-heading">
              <h2 id="fallback-heading" className="flex items-center gap-2 text-xl font-medium">
                <Home className="h-5 w-5 text-forest-600" aria-hidden="true" />
                If today is not an outside day
              </h2>
              <p className="mt-2 text-forest-700">
                <strong>{quest.indoorFallback.title}</strong> ({formatDuration(quest.indoorFallback.minutes)}). {quest.indoorFallback.summary}
              </p>
              <p className="mt-2 text-sm text-forest-600">It does not count as outdoor time. It keeps the idea going until you can get out.</p>
            </section>
          )}

          <div className="mt-10 border-t border-forest-800/10 pt-8">
            {quest.status === 'completed' ? (
              <div role="status" className="rounded-2xl bg-sage-100 p-6">
                <p className="flex items-center gap-2 text-lg font-semibold text-forest-900">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Quest complete
                </p>
                <p className="mt-1 text-forest-700">
                  {api.source === 'mock' ? 'This is saved in this browser only (demo mode).' : 'It has been added to your progress.'} You can do it again whenever you like.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <ButtonLink to="/progress" variant="primary">
                    See my progress
                  </ButtonLink>
                  <Button variant="secondary" onClick={() => setLogging({ quest, repeat: true })}>
                    Log another time
                  </Button>
                  <ButtonLink to="/quests" variant="ghost">
                    Find another quest
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <>
                {quest.status === 'in-progress' && (
                  <p role="status" className="mb-4 text-forest-700">
                    {startedAgo !== null ? `You started this ${startedAgo < 1 ? 'just now' : `${formatDuration(startedAgo)} ago`}.` : 'You started this quest.'} Log it when you are done.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {quest.status === 'available' && (
                    <Button size="lg" variant="primary" loading={busy === 'start'} onClick={() => void start(quest)}>
                      Start quest
                    </Button>
                  )}
                  <Button size="lg" variant="accent" onClick={() => setLogging({ quest, repeat: false })}>
                    {quest.status === 'in-progress' ? 'I finished it' : 'I already did it'}
                  </Button>
                  {quest.status === 'in-progress' && (
                    <Button size="lg" variant="ghost" loading={busy === 'cancel'} onClick={() => void putBack(quest)}>
                      Put it back for now
                    </Button>
                  )}
                </div>
                <p className="mt-3 text-sm text-forest-600">Only log it once you have done it. There is no deadline, and putting a quest back costs nothing.</p>
              </>
            )}
            {actionError && (
              <div className="mt-4">
                <ErrorMessage title="Something did not save" message={actionError} />
              </div>
            )}
          </div>
        </article>
      )}

      <QuestCompleteModal
        quest={logging?.quest ?? null}
        suggestedMinutes={suggestion.minutes}
        fromStart={suggestion.fromStart && !logging?.repeat}
        repeat={logging?.repeat ?? false}
        onSubmit={(input) => (logging ? complete(logging.quest, input) : Promise.resolve())}
        onClose={() => setLogging(null)}
      />
    </div>
  );
}
