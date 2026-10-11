import { List, Map as MapIcon, MapPinOff, RefreshCw, Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentChoice } from '../../hooks/usePersistentChoice';
import { api, ApiError } from '../../services/api';
import { DEFAULT_DIRECTIONS_PROVIDER } from '../../services/config';
import { GeolocationError, getDevicePosition } from '../../services/geolocation';
import type { GeocodeResult, Place, PlaceCategory } from '../../types';
import { buildDirectionsUrl, isDirectionsProvider } from '../../utils/directions';
import { parseCoordinates, roundCoordinate, type LatLon } from '../../utils/geo';
import { DEFAULT_PLACE_FILTERS, countByCategory, filterPlaces, sortPlaces, withDistances, type PlaceFilters, type PlaceSort } from '../../utils/places';
import { Button } from '../Button';
import { CheckChips, RadioChips } from '../ChoiceChips';
import { EmptyState } from '../EmptyState';
import { ErrorMessage } from '../ErrorMessage';
import { FormField } from '../FormField';
import { CardGridSkeleton, Skeleton } from '../LoadingState';
import { useToast } from '../ToastProvider';
import { LocationControls } from './LocationControls';
import { PlaceCard } from './PlaceCard';
import { PlaceDetailsModal } from './PlaceDetailsModal';

const PlacesMap = lazy(() => import('./PlacesMap'));

interface Origin extends LatLon {
  label: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';
type View = 'list' | 'map';

const RADIUS_OPTIONS = [
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
];
const SORT_OPTIONS: { value: PlaceSort; label: string }[] = [
  { value: 'distance', label: 'Nearest first' },
  { value: 'name', label: 'A to Z' },
];
const VIEW_OPTIONS: { value: View; label: string; icon: typeof List }[] = [
  { value: 'list', label: 'List', icon: List },
  { value: 'map', label: 'Map', icon: MapIcon },
];

function errorTitle(status?: number): string {
  if (status === 429) return 'Search limit reached';
  if (status === 503 || status === 504 || status === 502) return 'Map data is unavailable right now';
  return 'We could not load places';
}

export function PlacesDiscovery() {
  const demo = api.source === 'mock';
  const { notify } = useToast();

  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radius, setRadius] = useState(2000);
  const [includeTrails, setIncludeTrails] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [candidates, setCandidates] = useState<GeocodeResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_PLACE_FILTERS);
  const [sort, setSort] = useState<PlaceSort>('distance');
  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Place | null>(null);
  const [provider, setProvider] = usePersistentChoice('touchgrass.directionsProvider', DEFAULT_DIRECTIONS_PROVIDER, isDirectionsProvider);
  const [categories, setCategories] = useState<PlaceCategory[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const lastRef = useRef<{ origin: Origin; radius: number; trails: boolean } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Category names are static reference data, not personal. Fetched once to label the trail option and filters.
  useEffect(() => {
    let cancelled = false;
    api
      .getPlaceCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        /* labels fall back to what places carry */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function search(target: Origin, searchRadius: number, trails: boolean) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastRef.current = { origin: target, radius: searchRadius, trails };
    setStatus('loading');
    setError(null);
    setSelectedId(null);
    try {
      const defaults = categories.filter((c) => c.defaultOn).map((c) => c.id);
      const result = await api.getPlaces(roundCoordinate(target.lat), roundCoordinate(target.lon), searchRadius, {
        categories: trails && defaults.length > 0 ? [...defaults, 'trail'] : undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setPlaces(result);
      setStatus('success');
      window.setTimeout(() => resultsRef.current?.focus({ preventScroll: false }), 0);
    } catch (err) {
      if (err instanceof ApiError && err.aborted) return;
      setError({ message: err instanceof Error ? err.message : 'Something went wrong.', status: err instanceof ApiError ? err.status : undefined });
      setStatus('error');
    }
  }

  async function useDevice() {
    setSearchError(null);
    setCandidates(null);
    if (demo) {
      void search({ lat: 0, lon: 0, label: 'demo' }, radius, includeTrails);
      setOrigin(null);
      return;
    }
    setLocating(true);
    try {
      const position = await getDevicePosition();
      const next: Origin = { ...position, label: 'your location' };
      setOrigin(next);
      void search(next, radius, includeTrails);
    } catch (err) {
      notify(err instanceof GeolocationError ? err.message : 'Could not get your location.', 'info');
    } finally {
      setLocating(false);
    }
  }

  async function submitText(text: string) {
    setSearchError(null);
    setCandidates(null);
    const coords = parseCoordinates(text);
    if (coords) {
      const next: Origin = { ...coords, label: 'the coordinates you entered' };
      setOrigin(demo ? null : next);
      void search(next, radius, includeTrails);
      return;
    }
    setSearching(true);
    try {
      const found = await api.geocode(text);
      setCandidates(found);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not search for that place.');
    } finally {
      setSearching(false);
    }
  }

  function pickCandidate(candidate: GeocodeResult) {
    const short = candidate.label.split(',').slice(0, 2).join(',').trim();
    const next: Origin = { lat: candidate.lat, lon: candidate.lon, label: short || candidate.label };
    setCandidates(null);
    setOrigin(next);
    void search(next, radius, includeTrails);
  }

  function changeRadius(value: number) {
    setRadius(value);
    if (lastRef.current && status !== 'idle') void search(lastRef.current.origin, value, includeTrails);
  }

  function toggleTrails(on: boolean) {
    setIncludeTrails(on);
    if (lastRef.current && status !== 'idle') void search(lastRef.current.origin, radius, on);
  }

  function openDirections(place: Place) {
    const url = buildDirectionsUrl(provider, place, demo ? null : origin);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const showDistance = !demo && origin !== null;
  const enriched = useMemo(() => withDistances(places, demo ? null : origin), [places, origin, demo]);
  const visible = useMemo(() => sortPlaces(filterPlaces(enriched, filters), showDistance ? sort : 'name'), [enriched, filters, sort, showDistance]);
  const counts = useMemo(() => countByCategory(enriched), [enriched]);
  const categoryOptions = useMemo(() => {
    const labels = new Map(categories.map((c) => [c.id, c.label]));
    return Object.keys(counts)
      .sort()
      .map((id) => ({ value: id, label: `${labels.get(id) ?? enriched.find((p) => (p.categoryId ?? p.category) === id)?.category ?? id} (${counts[id]})` }));
  }, [counts, categories, enriched]);
  const filtered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_PLACE_FILTERS);
  const radiusLabel = RADIUS_OPTIONS.find((o) => o.value === radius)?.label ?? `${radius} m`;
  const selectedPlace = visible.find((p) => p.id === selectedId) ?? null;
  const busy = status === 'loading';

  return (
    <section aria-labelledby="places-heading" className="space-y-8">
      <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <h2 id="places-heading" className="text-3xl font-medium">
          Places to go outside
        </h2>
        <p className="mt-2 max-w-2xl text-forest-700">
          Parks, gardens, nature reserves, woodland, viewpoints and water near you, from OpenStreetMap. Nothing is searched until you press a button.
        </p>
        <div className="mt-6">
          <LocationControls
            demo={demo}
            busy={busy || searching}
            locating={locating}
            candidates={candidates}
            searchError={searchError}
            onUseDevice={() => void useDevice()}
            onSubmitText={(t) => void submitText(t)}
            onPickCandidate={pickCandidate}
            onDismissCandidates={() => setCandidates(null)}
          />
        </div>
        <p className="mt-6 border-t border-forest-800/10 pt-4 text-sm text-forest-600">
          {demo
            ? 'Demo mode: no location is read and nothing leaves your browser. The places below are fixed samples.'
            : 'Privacy: your position is rounded to about 100 m before it leaves this page, is used for this search only and is not saved by TouchGrass. The text you type in the area search is sent to OpenStreetMap Nominatim.'}
        </p>
      </div>

      {demo && status !== 'idle' && (
        <p role="note" className="rounded-2xl border border-ember-600/40 bg-ember-100/60 p-4 text-forest-900">
          <strong>Demo places.</strong> These are real parks in London shown as a sample, whatever you chose above. Distances are hidden because they are
          not near you. Connect the backend (VITE_USE_MOCK=false) for places around the area you choose.
        </p>
      )}

      {status !== 'idle' && (
        <div ref={resultsRef} tabIndex={-1} className="space-y-6 outline-none" aria-label="Place results">
          <div className="grid gap-6 rounded-3xl bg-white p-6 shadow-card lg:grid-cols-2">
            <FormField id="radius" legend label="Search radius" hint={demo ? 'Ignored in demo mode.' : 'Straight-line distance from your search point.'}>
              <RadioChips name="radius" options={RADIUS_OPTIONS} value={radius} onChange={changeRadius} />
            </FormField>
            <FormField id="more" legend label="Include">
              <CheckChips
                name="more"
                options={[{ value: 'trails', label: 'Named paths and trails' }]}
                values={includeTrails ? ['trails'] : []}
                onChange={(values) => toggleTrails(values.includes('trails'))}
              />
            </FormField>
            {status === 'success' && enriched.length > 0 && (
              <>
                <div>
                  <label htmlFor="place-query" className="block text-base font-semibold text-forest-900">
                    Filter by name
                  </label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-500" aria-hidden="true" />
                    <input
                      id="place-query"
                      type="search"
                      className="input pl-10"
                      value={filters.query}
                      onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                      placeholder="Lake, botanical, hill"
                    />
                  </div>
                </div>
                <FormField id="place-cats" legend label="Type of place">
                  <CheckChips
                    name="place-cats"
                    options={categoryOptions}
                    values={filters.categories}
                    onChange={(values) => setFilters((f) => ({ ...f, categories: values }))}
                  />
                </FormField>
                <FormField id="place-access" legend label="Accessibility" hint="Only what OpenStreetMap contributors have recorded. Not verified.">
                  <CheckChips
                    name="place-access"
                    options={[{ value: 'wheelchair', label: 'Wheelchair access listed' }]}
                    values={filters.wheelchairListedOnly ? ['wheelchair'] : []}
                    onChange={(values) => setFilters((f) => ({ ...f, wheelchairListedOnly: values.includes('wheelchair') }))}
                  />
                </FormField>
                {showDistance && (
                  <FormField id="place-sort" legend label="Sort">
                    <RadioChips name="place-sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
                  </FormField>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="text-sm text-forest-700">
              {busy && 'Looking for places'}
              {status === 'success' &&
                `${visible.length} of ${enriched.length} places${showDistance && origin ? ` within ${radiusLabel} of ${origin.label}` : ''}`}
            </p>
            {status === 'success' && enriched.length > 0 && (
              <div role="radiogroup" aria-label="Results view" className="inline-flex rounded-full border border-forest-800/25 bg-cream-50 p-1">
                {VIEW_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const on = view === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember-500 ${
                        on ? 'bg-forest-800 text-cream-50' : 'text-forest-800'
                      }`}
                    >
                      <input type="radio" name="places-view" className="sr-only" checked={on} onChange={() => setView(option.value)} />
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {busy && <CardGridSkeleton count={6} label="Looking for places" />}
          {status === 'error' && error && (
            <ErrorMessage
              title={errorTitle(error.status)}
              message={error.message}
              onRetry={lastRef.current ? () => void search(lastRef.current!.origin, lastRef.current!.radius, lastRef.current!.trails) : undefined}
            />
          )}

          {status === 'success' && enriched.length === 0 && (
            <EmptyState
              icon={MapPinOff}
              title="No mapped places found here"
              description="OpenStreetMap may have little mapped in this area, or nothing within this distance. Try a wider radius, add paths and trails, or search a nearby area."
              action={
                radius < 10000 ? (
                  <Button onClick={() => changeRadius(RADIUS_OPTIONS.find((o) => o.value > radius)?.value ?? 10000)}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Search a wider area
                  </Button>
                ) : undefined
              }
            />
          )}

          {status === 'success' && enriched.length > 0 && visible.length === 0 && (
            <EmptyState
              icon={MapPinOff}
              title="No places match those filters"
              description="Try removing a filter. Missing accessibility information is common in OpenStreetMap, so that filter can be strict."
              action={<Button onClick={() => setFilters(DEFAULT_PLACE_FILTERS)}>Clear filters</Button>}
            />
          )}

          {status === 'success' && visible.length > 0 && view === 'list' && (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((place) => (
                <li key={place.id}>
                  <PlaceCard place={place} showDistance={showDistance} onDetails={setDetail} onDirections={openDirections} />
                </li>
              ))}
            </ul>
          )}

          {status === 'success' && visible.length > 0 && view === 'map' && (
            <div className="space-y-4">
              <Suspense fallback={<Skeleton className="h-[26rem] w-full sm:h-[32rem]" />}>
                <PlacesMap places={visible} origin={demo ? null : origin} selectedId={selectedId} onSelect={(p) => setSelectedId(p.id)} />
              </Suspense>
              {selectedPlace ? (
                <div className="max-w-md">
                  <PlaceCard place={selectedPlace} showDistance={showDistance} selected onDetails={setDetail} onDirections={openDirections} />
                </div>
              ) : (
                <p className="text-sm text-forest-600">Select a marker to see the place here.</p>
              )}
            </div>
          )}

          {status === 'success' && enriched.length > 0 && (
            <p className="text-xs text-forest-600">
              {demo ? 'Place data: ' : 'Place data from '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL). It is community-maintained and can be incomplete or out of date. Always check on site.
              {filtered && (
                <>
                  {' '}
                  <button type="button" className="font-semibold underline" onClick={() => setFilters(DEFAULT_PLACE_FILTERS)}>
                    Clear filters
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {status === 'idle' && (
        <EmptyState
          icon={MapPinOff}
          title="Choose where to look"
          description="Press the button to search around you, or type a place. If you would rather not share your location, the search box works on its own."
        />
      )}

      <PlaceDetailsModal
        place={detail}
        origin={demo ? null : origin}
        originLabel={origin?.label ?? null}
        showDistance={showDistance}
        provider={provider}
        onProviderChange={setProvider}
        onClose={() => setDetail(null)}
      />
    </section>
  );
}
