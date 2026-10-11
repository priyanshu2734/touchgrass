import { useSearchParams } from 'react-router-dom';
import { ActivityIdeas } from '../components/ActivityIdeas';
import { PlacesDiscovery } from '../components/places/PlacesDiscovery';
import { SectionHeading } from '../components/SectionHeading';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cn } from '../utils/cn';

type ViewId = 'places' | 'ideas';

const TABS: { id: ViewId; label: string }[] = [
  { id: 'places', label: 'Places near you' },
  { id: 'ideas', label: 'Activity ideas' },
];

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const view: ViewId = params.get('view') === 'ideas' ? 'ideas' : 'places';
  useDocumentTitle(
    view === 'places' ? 'Places near you' : 'Explore activities',
    'Find parks, gardens and nature spots near you, or search outdoor activities by time, budget, energy and interests.',
  );

  return (
    <div className="container-page py-12 lg:py-16">
      <SectionHeading
        as="h1"
        title="Explore"
        description="Find a real place to go, or an idea for what to do when you get there. Start with whichever you have."
      />

      <div role="tablist" aria-label="Explore sections" className="mt-8 flex gap-2 border-b border-forest-800/15">
        {TABS.map((tab) => {
          const selected = tab.id === view;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setParams(tab.id === 'places' ? {} : { view: tab.id }, { replace: true })}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  const next = TABS[(TABS.findIndex((t) => t.id === view) + 1) % TABS.length];
                  setParams(next.id === 'places' ? {} : { view: next.id }, { replace: true });
                  window.setTimeout(() => document.getElementById(`tab-${next.id}`)?.focus(), 0);
                }
              }}
              className={cn(
                '-mb-px rounded-t-xl border-b-2 px-5 py-3 text-base font-semibold transition-colors',
                selected ? 'border-ember-500 text-forest-950' : 'border-transparent text-forest-600 hover:text-forest-900',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} className="mt-10">
        {view === 'places' ? <PlacesDiscovery /> : <ActivityIdeas />}
      </div>
    </div>
  );
}
