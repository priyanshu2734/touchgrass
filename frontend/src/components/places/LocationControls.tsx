import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { GeocodeResult } from '../../types';
import { Button } from '../Button';
import { FormField, hintId } from '../FormField';

interface Props {
  demo: boolean;
  busy: boolean;
  locating: boolean;
  candidates: GeocodeResult[] | null;
  searchError: string | null;
  onUseDevice: () => void;
  onSubmitText: (text: string) => void;
  onPickCandidate: (candidate: GeocodeResult) => void;
  onDismissCandidates: () => void;
}

/** Two equal ways to choose where to look. Neither runs until the person presses a button. */
export function LocationControls({
  demo,
  busy,
  locating,
  candidates,
  searchError,
  onUseDevice,
  onSubmitText,
  onPickCandidate,
  onDismissCandidates,
}: Props) {
  const [text, setText] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length >= 2) onSubmitText(text.trim());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <h3 className="text-lg font-medium">Use your location</h3>
        <p className="mt-1 text-sm text-forest-700">
          {demo
            ? 'Demo mode does not use your location, so your browser will not ask.'
            : 'Your browser asks for permission only when you press this button. You can say no and use the search instead.'}
        </p>
        <Button variant="accent" size="lg" className="mt-4" onClick={onUseDevice} loading={locating} disabled={busy && !locating}>
          {!locating && <LocateFixed className="h-5 w-5" aria-hidden="true" />}
          {demo ? 'Show demo places' : 'Find places near me'}
        </Button>
      </div>

      <form onSubmit={submit} noValidate aria-label="Search another area">
        <FormField
          id="area-search"
          label="Or search an area"
          hint={
            demo
              ? 'Demo mode: coordinates such as 51.5, -0.12 work, place names need the backend.'
              : "A city, neighbourhood or coordinates. Place names are looked up with OpenStreetMap's Nominatim service."
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-500" aria-hidden="true" />
              <input
                id="area-search"
                type="text"
                className="input pl-10"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder="e.g. Bhubaneswar, or 20.27, 85.84"
                aria-describedby={hintId('area-search')}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy || text.trim().length < 2}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </div>
        </FormField>
        {searchError && (
          <p role="alert" className="mt-3 text-sm font-medium text-ember-700">
            {searchError}
          </p>
        )}
        {candidates && candidates.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-forest-900" id="candidates-label">
                Which one do you mean?
              </p>
              <button type="button" onClick={onDismissCandidates} className="grid h-8 w-8 place-items-center rounded-full hover:bg-forest-800/10" aria-label="Dismiss results">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-2 space-y-1" aria-labelledby="candidates-label">
              {candidates.map((candidate) => (
                <li key={`${candidate.lat},${candidate.lon}`}>
                  <button
                    type="button"
                    onClick={() => onPickCandidate(candidate)}
                    className="w-full rounded-xl px-3 py-2 text-left text-[15px] text-forest-800 hover:bg-sage-100"
                  >
                    {candidate.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {candidates && candidates.length === 0 && (
          <p className="mt-3 text-sm text-forest-700" role="status">
            Nothing matched that search. Try a nearby city or type coordinates instead.
          </p>
        )}
      </form>
    </div>
  );
}
