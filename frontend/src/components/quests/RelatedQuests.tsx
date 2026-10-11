import { useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import type { BarrierId, PlanPreferences } from '../../types';
import { buildConstraints, matchQuests } from '../../utils/questMatching';
import { ErrorMessage } from '../ErrorMessage';
import { Skeleton } from '../LoadingState';
import { QuestMatchList } from './QuestMatchList';

interface Props {
  preferences: PlanPreferences;
  barriers: BarrierId[];
}

/** Shown under a plan: curated quests that respect the same limits, matched by rules (not AI). */
export function RelatedQuests({ preferences, barriers }: Props) {
  const { data, error, loading, reload } = useAsync(() => api.getQuests(), []);
  const result = useMemo(
    () => (data ? matchQuests(data, buildConstraints(barriers, preferences), 4) : null),
    [data, barriers, preferences],
  );

  return (
    <section aria-labelledby="related-heading" className="mt-10">
      <h2 id="related-heading" className="text-2xl font-medium">
        Quests that fit the same limits
      </h2>
      <p className="mt-1 text-sm text-forest-600">Matched by simple rules from the hand-written quest list, using the answers you gave.</p>
      <div className="mt-4">
        {loading && <Skeleton className="h-40 w-full" />}
        {error && <ErrorMessage message={error} onRetry={reload} />}
        {result && <QuestMatchList result={result} />}
      </div>
    </section>
  );
}
