import { useMemo, useState } from 'react';
import { INTEREST_IDS, INTEREST_META } from '../../data/options';
import type { BarrierId, Interest, Quest, TimeOption } from '../../types';
import { ButtonLink } from '../Button';
import { CheckChips, RadioChips } from '../ChoiceChips';
import { FormField } from '../FormField';
import { buildConstraints, matchQuests } from '../../utils/questMatching';
import { QuestMatchList } from './QuestMatchList';
import { BarrierChips } from './BarrierChips';

type TimeChoice = 'any' | TimeOption;
const TIME_CHOICES: { value: TimeChoice; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
];
const INTEREST_OPTIONS = INTEREST_IDS.map((id) => ({ value: id, label: INTEREST_META[id].label, icon: INTEREST_META[id].icon }));

/** "What fits today?" Matches the curated quest list to practical limits. Rules only, no AI. */
export function FitFinder({ quests }: { quests: Quest[] }) {
  const [barriers, setBarriers] = useState<BarrierId[]>([]);
  const [time, setTime] = useState<TimeChoice>('any');
  const [interests, setInterests] = useState<Interest[]>([]);

  const result = useMemo(() => {
    const constraints = buildConstraints(barriers, { minutes: time === 'any' ? undefined : time, interests });
    return matchQuests(quests, constraints, 4);
  }, [quests, barriers, time, interests]);

  const hasInput = barriers.length > 0 || time !== 'any' || interests.length > 0;
  const planLink = `/plan?${new URLSearchParams({
    ...(time !== 'any' ? { minutes: String(time) } : barriers.includes('short-time') ? { minutes: '20' } : {}),
    ...(barriers.includes('low-energy') || barriers.includes('accessible') ? { energy: 'low' } : {}),
    ...(interests.length ? { interests: interests.join(',') } : {}),
    ...(barriers.length ? { barriers: barriers.join(',') } : {}),
  }).toString()}`;

  return (
    <section aria-labelledby="fit-heading" className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
      <h2 id="fit-heading" className="text-3xl font-medium">
        What fits today?
      </h2>
      <p className="mt-2 max-w-2xl text-forest-700">
        Pick anything that is true for you right now. The list narrows to quests that really work with it. Skipping all of them is fine too.
      </p>

      <div className="mt-6 space-y-6">
        <FormField id="fit-barriers" legend label="What is getting in the way?" optional>
          <BarrierChips name="fit-barriers" values={barriers} onChange={setBarriers} />
        </FormField>
        <div className="grid gap-6 md:grid-cols-2">
          <FormField id="fit-time" legend label="Time you have" optional>
            <RadioChips name="fit-time" options={TIME_CHOICES} value={time} onChange={setTime} />
          </FormField>
          <FormField id="fit-interests" legend label="What sounds good?" optional>
            <CheckChips name="fit-interests" options={INTEREST_OPTIONS} values={interests} onChange={setInterests} />
          </FormField>
        </div>
      </div>

      <div className="mt-8 border-t border-forest-800/10 pt-6" aria-live="polite">
        <p className="mb-4 text-sm text-forest-600">
          {hasInput
            ? 'Matched by simple rules from the hand-written quest list. No AI is involved in this step.'
            : 'Showing a few gentle starting points. Choose any of the options above to narrow them.'}
        </p>
        <QuestMatchList result={result} onRemoveBarriers={(ids) => setBarriers((current) => current.filter((b) => !ids.includes(b)))} />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink to={planLink} variant="secondary" size="sm">
            Build a full plan from these answers
          </ButtonLink>
          <span className="text-sm text-forest-600">Uses the same planner as the Planner page, with a checklist and a backup.</span>
        </div>
      </div>
    </section>
  );
}
