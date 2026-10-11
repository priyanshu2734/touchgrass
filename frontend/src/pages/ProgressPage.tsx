import { CalendarDays, CheckCircle2, Flame, NotebookPen, Plus, Sprout, Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonLink } from '../components/Button';
import { Counter } from '../components/Counter';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Skeleton } from '../components/LoadingState';
import { Modal } from '../components/Modal';
import { ActivityStrip } from '../components/progress/ActivityStrip';
import { EntryModal } from '../components/progress/EntryModal';
import { LogSessionModal } from '../components/progress/LogSessionModal';
import { SectionHeading } from '../components/SectionHeading';
import { useToast } from '../components/ToastProvider';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import { clearAll } from '../services/mock/store';
import type { Milestone, Progress, ProgressEntry, SessionInput } from '../types';
import { cn } from '../utils/cn';
import { formatDate, formatDuration } from '../utils/format';

const UNIT_LABEL: Record<Milestone['unit'], string> = { quests: 'quests', days: 'days', minutes: 'minutes' };

export function ProgressPage() {
  useDocumentTitle('My progress', 'Your completed outdoor quests, outdoor minutes, streak, milestones and notes.');
  const { data, error, loading, reload, setData } = useAsync(() => api.getProgress(), []);
  const { notify } = useToast();
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState<ProgressEntry | null>(null);
  const [resetting, setResetting] = useState(false);

  async function logSession(input: SessionInput) {
    setData(await api.logSession(input));
    setLogging(false);
    notify('Time outside logged.', 'success');
  }
  async function saveNote(entry: ProgressEntry, note: string) {
    if (!entry.id) throw new Error('This entry cannot be edited.');
    setData(await api.updateEntryNote(entry.id, note || undefined));
    setEditing(null);
    notify('Note saved.', 'success');
  }
  async function removeEntry(entry: ProgressEntry) {
    if (!entry.id) throw new Error('This entry cannot be removed.');
    setData(await api.deleteEntry(entry.id));
    setEditing(null);
    notify('Entry removed.', 'info');
  }
  function resetDemo() {
    clearAll();
    setResetting(false);
    notify('Demo progress cleared.', 'info');
    reload();
  }

  const progress: Progress | null = data;
  const activeDates = progress?.activeDates ?? progress?.recent.map((e) => e.localDate).filter((d): d is string => Boolean(d)) ?? [];
  const stats = progress
    ? [
        { label: 'Quests completed', value: progress.completedActivities, icon: CheckCircle2 },
        { label: 'Outdoor minutes you recorded', value: progress.outdoorMinutes, icon: Timer },
        { label: 'Current streak (days)', value: progress.currentStreak, icon: Flame },
        { label: 'Longest streak (days)', value: progress.longestStreak, icon: Trophy },
      ]
    : [];
  const isEmpty = progress ? progress.recent.length === 0 : false;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          as="h1"
          title="My progress"
          description="Only things you have actually done show up here. Minutes are the ones you entered, and a streak is a run of days with time outside logged."
        />
        <Button variant="accent" onClick={() => setLogging(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log time outside
        </Button>
      </div>

      {loading && (
        <div role="status" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">Loading your progress</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}
      {error && (
        <div className="mt-10">
          <ErrorMessage message={error} onRetry={reload} />
        </div>
      )}

      {progress && (
        <>
          <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex flex-col-reverse rounded-2xl bg-white p-5 shadow-card">
                  <dt className="mt-1 text-sm text-forest-600">{stat.label}</dt>
                  <dd className="flex items-center justify-between font-display text-4xl font-medium text-forest-900">
                    <Counter value={stat.value} />
                    <Icon className="h-6 w-6 text-forest-400" aria-hidden="true" />
                  </dd>
                </div>
              );
            })}
          </dl>
          {progress.plansGenerated !== undefined && progress.plansGenerated > 0 && (
            <p className="mt-3 text-sm text-forest-600">
              You have built {progress.plansGenerated} {progress.plansGenerated === 1 ? 'plan' : 'plans'} with the planner. Plans are not counted as outdoor time until you log it.
            </p>
          )}
          {progress.currentStreak === 0 && progress.longestStreak > 0 && (
            <p className="mt-3 text-sm text-forest-600">A new streak can start on any day. Your longest run stays on record.</p>
          )}

          {isEmpty && (
            <div className="mt-10">
              <EmptyState
                icon={Sprout}
                title="Nothing logged yet, and that is fine"
                description="Finish a quest or log a few minutes outside and it will show up here, with your streak and milestones. A five-minute quest is enough."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <ButtonLink to="/quests">Find a quest</ButtonLink>
                    <Button variant="secondary" onClick={() => setLogging(true)}>
                      Log time outside
                    </Button>
                  </div>
                }
              />
            </div>
          )}

          <section className="mt-14" aria-labelledby="days-heading">
            <h2 id="days-heading" className="flex items-center gap-2 text-3xl font-medium">
              <CalendarDays className="h-6 w-6 text-forest-500" aria-hidden="true" />
              Last two weeks
            </h2>
            <div className="mt-5">
              <ActivityStrip activeDates={activeDates} />
            </div>
          </section>

          <section className="mt-14" aria-labelledby="milestones-heading">
            <h2 id="milestones-heading" className="text-3xl font-medium">
              Milestones
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {progress.milestones.map((milestone) => {
                const percent = Math.round((Math.min(milestone.current, milestone.target) / milestone.target) * 100);
                return (
                  <li key={milestone.id} className={cn('rounded-2xl border p-5', milestone.achieved ? 'border-sage-300 bg-sage-100' : 'border-forest-800/15 bg-cream-50')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-medium">{milestone.title}</h3>
                        <p className="mt-1 text-forest-700">{milestone.description}</p>
                      </div>
                      {milestone.achieved && (
                        <span className="flex items-center gap-1 text-sm font-semibold text-forest-800">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Reached
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-4 h-2 overflow-hidden rounded-full bg-forest-800/10"
                      role="progressbar"
                      aria-label={milestone.title}
                      aria-valuemin={0}
                      aria-valuemax={milestone.target}
                      aria-valuenow={milestone.current}
                      aria-valuetext={`${milestone.current} of ${milestone.target} ${UNIT_LABEL[milestone.unit]}`}
                    >
                      <div className="h-full rounded-full bg-forest-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-2 text-sm text-forest-600">
                      {milestone.current} of {milestone.target} {UNIT_LABEL[milestone.unit]}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {progress.recent.length > 0 && (
            <section className="mt-14" aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="text-3xl font-medium">
                History and notes
              </h2>
              <ul className="mt-6 divide-y divide-forest-800/10 rounded-2xl bg-white shadow-card">
                {progress.recent.map((entry) => (
                  <li key={entry.id ?? `${entry.questId}-${entry.completedAt}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-forest-900">{entry.title}</p>
                      <p className="text-sm text-forest-600">
                        {formatDate(entry.completedAt)} · {formatDuration(entry.minutes)}
                        {entry.kind === 'session' ? ' · Logged without a quest' : ''}
                      </p>
                      {entry.note && <p className="mt-2 whitespace-pre-line text-forest-800">{entry.note}</p>}
                    </div>
                    {entry.id && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(entry)}>
                        <NotebookPen className="h-4 w-4" aria-hidden="true" />
                        {entry.note ? 'Edit' : 'Add note'}
                        <span className="sr-only"> for {entry.title} on {formatDate(entry.completedAt)}</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-forest-600">Showing your {progress.recent.length} most recent entries.</p>
            </section>
          )}

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-forest-800/15 p-5">
            <p className="max-w-xl text-sm text-forest-700">
              {api.source === 'mock'
                ? 'Demo mode: this progress is stored only in this browser. It is not sent anywhere and will not follow you to another device.'
                : 'Your entries and notes are stored by the TouchGrass server you are connected to. There are no leaderboards and nothing here is shared.'}
            </p>
            {api.source === 'mock' && (
              <Button variant="secondary" size="sm" onClick={() => setResetting(true)} disabled={isEmpty}>
                Clear demo progress
              </Button>
            )}
          </div>
        </>
      )}

      <LogSessionModal open={logging} onSubmit={logSession} onClose={() => setLogging(false)} />
      <EntryModal entry={editing} onSaveNote={saveNote} onRemove={removeEntry} onClose={() => setEditing(null)} />
      <Modal open={resetting} onClose={() => setResetting(false)} title="Clear demo progress?" description="This removes everything saved in this browser. It cannot be undone.">
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setResetting(false)} data-autofocus>
            Keep it
          </Button>
          <Button variant="accent" onClick={resetDemo}>
            Clear it
          </Button>
        </div>
      </Modal>
    </div>
  );
}
