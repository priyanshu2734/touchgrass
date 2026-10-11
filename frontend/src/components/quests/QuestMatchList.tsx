import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DIFFICULTY_LABEL, QUEST_CATEGORY_META } from '../../data/options';
import type { BarrierId } from '../../types';
import type { MatchResult } from '../../utils/questMatching';
import { formatDuration } from '../../utils/format';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';

interface Props {
  result: MatchResult;
  /** Lets the person switch off the limit that blocks everything, instead of us deciding for them. */
  onRemoveBarriers?: (ids: BarrierId[]) => void;
  /** Hide the "N more" line when the list is already the full set. */
  heading?: string;
}

export function QuestMatchList({ result, onRemoveBarriers, heading }: Props) {
  if (result.matches.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="Nothing fits every limit at once"
        description={
          result.relaxations.length > 0
            ? 'That is a gap in the quest list, not a problem with you. You decide what to loosen:'
            : 'No quest in the list carries all the details these limits need. Try removing one.'
        }
        action={
          result.relaxations.length > 0 && onRemoveBarriers ? (
            <div className="flex flex-wrap justify-center gap-2">
              {result.relaxations.map((r) => (
                <Button key={r.key} variant="secondary" size="sm" onClick={() => onRemoveBarriers(r.barriers)}>
                  Without {r.label}: {r.count} {r.count === 1 ? 'quest' : 'quests'}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <div>
      {heading && <h3 className="text-xl font-medium">{heading}</h3>}
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {result.matches.map(({ quest, reasons, caveats, suggestFallback }) => {
          const Icon = QUEST_CATEGORY_META[quest.category].icon;
          return (
            <li key={quest.id} className="flex flex-col rounded-2xl border border-forest-800/15 bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest-800">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h4 className="font-display text-xl font-medium leading-snug text-forest-900">{quest.title}</h4>
                  <p className="text-sm text-forest-600">{QUEST_CATEGORY_META[quest.category].label}</p>
                </div>
              </div>
              <p className="mt-3 text-[15px] text-forest-700">{quest.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{formatDuration(quest.minutes)}</Badge>
                <Badge>{DIFFICULTY_LABEL[quest.difficulty]}</Badge>
              </div>
              {reasons.length > 0 && (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-forest-700">
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {caveats.map((caveat) => (
                <p key={caveat} className="mt-2 text-sm text-forest-600">
                  {caveat}
                </p>
              ))}
              {quest.indoorFallback && (
                <details className="mt-3 rounded-xl bg-cream-200/60 p-3 text-sm text-forest-800" open={suggestFallback}>
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Indoor fallback for today
                  </summary>
                  <p className="mt-2">
                    <strong>{quest.indoorFallback.title}</strong> ({formatDuration(quest.indoorFallback.minutes)}). {quest.indoorFallback.summary}
                  </p>
                </details>
              )}
              <div className="mt-auto pt-4">
                <Link
                  to={`/quests/${quest.id}`}
                  className="text-sm font-semibold text-forest-800 underline decoration-ember-500 decoration-2 underline-offset-4 hover:text-forest-950"
                >
                  Open quest<span className="sr-only">: {quest.title}</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {result.total > result.matches.length && (
        <p className="mt-3 text-sm text-forest-600">
          Showing the top {result.matches.length} of {result.total} quests that fit.
        </p>
      )}
    </div>
  );
}
