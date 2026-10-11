import { Accessibility, Clock, Navigation, ExternalLink } from 'lucide-react';
import type { Place } from '../../types';
import { cn } from '../../utils/cn';
import { formatDistance } from '../../utils/geo';
import { Badge } from '../Badge';
import { Button } from '../Button';

const WHEELCHAIR: Record<NonNullable<Place['wheelchair']>, string> = {
  yes: 'Wheelchair access listed: yes',
  limited: 'Wheelchair access listed: limited',
  no: 'Wheelchair access listed: no',
};

interface PlaceCardProps {
  place: Place;
  /** False in demo mode, because demo places are not near the person. */
  showDistance: boolean;
  selected?: boolean;
  onDetails: (place: Place) => void;
  onDirections: (place: Place) => void;
}

export function PlaceCard({ place, showDistance, selected, onDetails, onDirections }: PlaceCardProps) {
  const distance = showDistance ? formatDistance(place.distanceMeters) : null;
  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border bg-white p-5 shadow-card transition-colors',
        selected ? 'border-forest-700 ring-2 ring-forest-700/30' : 'border-transparent',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="sage">{place.category}</Badge>
        {distance && <Badge>{distance} straight-line</Badge>}
        {place.named === false && <Badge tone="ember">No name in OpenStreetMap</Badge>}
      </div>
      <h3 className="mt-3 text-xl font-medium leading-snug">{place.name}</h3>

      <ul className="mt-3 space-y-1.5 text-sm text-forest-700">
        <li className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" aria-hidden="true" />
          {place.openingHours ? (
            <span>
              Listed hours: {place.openingHours} <span className="text-forest-600">(from OpenStreetMap, may be out of date)</span>
            </span>
          ) : (
            <span>Opening hours: not listed</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <Accessibility className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" aria-hidden="true" />
          <span>{place.wheelchair ? WHEELCHAIR[place.wheelchair] : 'Accessibility: not listed'}</span>
        </li>
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button size="sm" variant="primary" onClick={() => onDirections(place)}>
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Directions
          <span className="sr-only"> to {place.name}</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onDetails(place)}>
          Details
          <span className="sr-only"> for {place.name}</span>
        </Button>
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-forest-800 underline decoration-ember-500 decoration-2 underline-offset-4"
          >
            Website
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only"> for {place.name} (opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  );
}
