import { Clock, Gauge, Wallet, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ENERGY_LABEL, DIFFICULTY_LABEL, INTEREST_META } from '../data/options';
import type { Activity } from '../types';
import { formatCost, formatDuration, hashString, nearestTimeOption } from '../utils/format';
import { Badge } from './Badge';
import { ContourArt } from './ContourArt';

export function ActivityCard({ activity }: { activity: Activity }) {
  const primary = INTEREST_META[activity.interests[0]];
  const PrimaryIcon = primary.icon;
  const plannerLink = `/plan?minutes=${nearestTimeOption(activity.minutes)}&energy=${activity.energy}&interests=${activity.interests.join(',')}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-shadow duration-200 hover:shadow-lift">
      <div className="relative h-32 shrink-0">
        <ContourArt seed={hashString(activity.id)} tone={primary.tone} className="absolute inset-0 h-full w-full" />
        <span className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-cream-50 text-forest-800 shadow-card">
          <PrimaryIcon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm text-forest-600">{activity.type}</p>
        <h3 className="mt-1 text-xl font-medium leading-snug">{activity.title}</h3>
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-forest-700">{activity.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge icon={Clock}>{formatDuration(activity.minutes)}</Badge>
          <Badge icon={Wallet}>{formatCost(activity.cost)}</Badge>
          <Badge icon={Gauge}>{DIFFICULTY_LABEL[activity.difficulty]}</Badge>
          <Badge icon={Zap}>{ENERGY_LABEL[activity.energy]}</Badge>
        </div>
        <div className="mt-auto pt-5">
          <Link
            to={plannerLink}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-800 underline decoration-ember-500 decoration-2 underline-offset-4 hover:text-forest-950"
          >
            Plan something like this
            <span className="sr-only">: {activity.title}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
