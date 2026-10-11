import { CheckCircle2, Circle, Clock, Gauge, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DIFFICULTY_LABEL, QUEST_CATEGORY_META } from '../data/options';
import type { Quest } from '../types';
import { formatDuration } from '../utils/format';
import { Badge } from './Badge';

export function QuestCard({ quest }: { quest: Quest }) {
  const meta = QUEST_CATEGORY_META[quest.category];
  const Icon = meta.icon;
  const done = quest.status === 'completed';

  return (
    <article className="flex h-full flex-col rounded-2xl border border-forest-800/15 bg-cream-50 p-5 transition-colors hover:border-forest-800/40">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage-100 text-forest-800">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {quest.status === 'in-progress' ? (
          <Badge tone="ember" icon={PlayCircle}>
            In progress
          </Badge>
        ) : done ? (
          <Badge tone="forest" icon={CheckCircle2}>
            {quest.completionCount && quest.completionCount > 1 ? `Completed ${quest.completionCount} times` : 'Completed'}
          </Badge>
        ) : (
          <Badge tone="neutral" icon={Circle}>
            Not started
          </Badge>
        )}
      </div>
      <p className="mt-4 text-sm text-forest-600">{meta.label}</p>
      <h3 className="mt-1 text-xl font-medium leading-snug">{quest.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-forest-700">{quest.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge icon={Gauge}>{DIFFICULTY_LABEL[quest.difficulty]}</Badge>
        <Badge icon={Clock}>{formatDuration(quest.minutes)}</Badge>
      </div>
      <div className="mt-auto pt-5">
        <Link
          to={`/quests/${quest.id}`}
          className="text-sm font-semibold text-forest-800 underline decoration-ember-500 decoration-2 underline-offset-4 hover:text-forest-950"
        >
          {quest.status === 'in-progress' ? 'Continue quest' : done ? 'Revisit quest' : 'View quest'}
          <span className="sr-only">: {quest.title}</span>
        </Link>
      </div>
    </article>
  );
}
