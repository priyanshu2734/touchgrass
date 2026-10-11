import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { DIRECTIONS_PROVIDERS, DIRECTIONS_PROVIDER_IDS, buildDirectionsUrl, givesRoute, type DirectionsProviderId } from '../../utils/directions';
import { formatCoordinates, formatDistance, type LatLon } from '../../utils/geo';
import type { Place } from '../../types';
import { ButtonLink } from '../Button';
import { Modal } from '../Modal';
import { useToast } from '../ToastProvider';

interface Props {
  place: Place | null;
  origin: LatLon | null;
  originLabel: string | null;
  showDistance: boolean;
  provider: DirectionsProviderId;
  onProviderChange: (provider: DirectionsProviderId) => void;
  onClose: () => void;
}

const WHEELCHAIR = { yes: 'Listed as accessible', limited: 'Listed as partly accessible', no: 'Listed as not accessible' } as const;

export function PlaceDetailsModal({ place, origin, originLabel, showDistance, provider, onProviderChange, onClose }: Props) {
  const { notify } = useToast();
  const [last, setLast] = useState<Place | null>(null);
  if (place && place !== last) setLast(place);
  const shown = place ?? last;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Coordinates copied.', 'success');
    } catch {
      notify('Could not copy. Select the coordinates and copy them manually.', 'error');
    }
  }

  const distance = shown && showDistance ? formatDistance(shown.distanceMeters) : null;

  return (
    <Modal open={place !== null} onClose={onClose} title={shown?.name ?? 'Place'} description={shown?.category} size="lg">
      {shown && (
        <div className="space-y-6">
          <dl className="grid gap-x-6 gap-y-4 text-[15px] sm:grid-cols-2">
            {distance && (
              <div>
                <dt className="font-semibold text-forest-900">Distance</dt>
                <dd className="text-forest-700">
                  About {distance} in a straight line from {originLabel ?? 'your search point'}. Walking distance will be longer.
                </dd>
              </div>
            )}
            <div>
              <dt className="font-semibold text-forest-900">Coordinates</dt>
              <dd className="flex items-center gap-2 text-forest-700">
                <span>{formatCoordinates(shown)}</span>
                <button
                  type="button"
                  onClick={() => void copy(formatCoordinates(shown, 6))}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-forest-800/10"
                  aria-label="Copy coordinates"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
              </dd>
              <dd className="text-xs text-forest-600">The centre point of the mapped area. Entrances may be elsewhere.</dd>
            </div>
            <div>
              <dt className="font-semibold text-forest-900">Opening hours</dt>
              <dd className="text-forest-700">{shown.openingHours ?? 'Not listed'}</dd>
              {shown.openingHours && <dd className="text-xs text-forest-600">From OpenStreetMap contributors. Not verified, may be out of date.</dd>}
            </div>
            <div>
              <dt className="font-semibold text-forest-900">Accessibility</dt>
              <dd className="text-forest-700">{shown.wheelchair ? WHEELCHAIR[shown.wheelchair] : 'Not listed'}</dd>
              <dd className="text-xs text-forest-600">Surfaces, steps, seating, safety and closures are not covered by this data.</dd>
            </div>
          </dl>

          <p className="rounded-2xl bg-cream-200/70 p-4 text-sm text-forest-800">
            TouchGrass does not know about ratings, crowds, safety or live conditions here, so none are shown. Check signs and local information
            before you go.
          </p>

          <section aria-labelledby="dir-heading">
            <h3 id="dir-heading" className="text-lg font-medium">
              Open directions
            </h3>
            <fieldset className="mt-3">
              <legend className="sr-only">Map service</legend>
              <div className="flex flex-wrap gap-2">
                {DIRECTIONS_PROVIDER_IDS.map((id) => (
                  <label
                    key={id}
                    className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember-500 ${
                      provider === id ? 'border-forest-800 bg-forest-800 text-cream-50' : 'border-forest-800/25 bg-cream-50 text-forest-800'
                    }`}
                  >
                    <input type="radio" name="directions-provider" className="sr-only" checked={provider === id} onChange={() => onProviderChange(id)} />
                    {DIRECTIONS_PROVIDERS[id].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-3 text-sm text-forest-700">
              Opens {DIRECTIONS_PROVIDERS[provider].label} in a new tab and shares {DIRECTIONS_PROVIDERS[provider].shares}.
              {!givesRoute(provider, origin) && ' Without a search point this shows the place on the map rather than a route.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={buildDirectionsUrl(provider, shown, origin)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-5 text-[15px] font-semibold text-cream-50 hover:bg-forest-700"
              >
                {givesRoute(provider, origin) ? 'Get directions' : 'Show on map'}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {shown.osmUrl && (
                <a
                  href={shown.osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-800/30 px-5 text-[15px] font-semibold text-forest-800 hover:bg-white"
                >
                  View on OpenStreetMap
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <ButtonLink to="/quests" variant="ghost">
                Find a quest to do there
              </ButtonLink>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
