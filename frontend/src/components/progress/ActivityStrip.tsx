import { Check } from 'lucide-react';
import { lastDays } from '../../utils/dates';
import { cn } from '../../utils/cn';

interface Props {
  /** Local dates (YYYY-MM-DD) with at least one entry. */
  activeDates: string[];
  days?: number;
  now?: Date;
}

/** The last two weeks at a glance. Empty days are neutral on purpose: this is a record, not a scorecard. */
export function ActivityStrip({ activeDates, days = 14, now }: Props) {
  const active = new Set(activeDates);
  const keys = lastDays(days, now);
  const count = keys.filter((k) => active.has(k)).length;
  return (
    <figure>
      <figcaption className="text-sm text-forest-700">
        {count === 0 ? `Nothing logged in the last ${days} days.` : `Time outside on ${count} of the last ${days} days.`}
      </figcaption>
      <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`Last ${days} days, oldest first`}>
        {keys.map((key) => {
          const on = active.has(key);
          const date = new Date(`${key}T12:00:00`);
          const label = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
          return (
            <li key={key} className="text-center">
              <span
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full border text-xs',
                  on ? 'border-forest-700 bg-forest-700 text-cream-50' : 'border-forest-800/20 bg-cream-50 text-forest-500',
                )}
                title={`${label}: ${on ? 'time outside logged' : 'nothing logged'}`}
              >
                {on ? <Check className="h-4 w-4" aria-hidden="true" /> : date.getDate()}
                <span className="sr-only">
                  {label}: {on ? 'time outside logged' : 'nothing logged'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
