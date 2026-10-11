import { Search, SlidersHorizontal, TreePine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityCard } from './ActivityCard';
import { Button } from './Button';
import { CheckChips, RadioChips } from './ChoiceChips';
import { EmptyState } from './EmptyState';
import { ErrorMessage } from './ErrorMessage';
import { FormField } from './FormField';
import { CardGridSkeleton } from './LoadingState';
import { INTEREST_IDS, INTEREST_META } from '../data/options';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import type { Activity, Budget, Energy, Interest } from '../types';

type TimeFilter = 'any' | '10' | '20' | '30' | '60' | '120';
type BudgetFilter = 'any' | Budget;
type EnergyFilter = 'any' | Energy;

interface Filters {
  query: string;
  time: TimeFilter;
  budget: BudgetFilter;
  energy: EnergyFilter;
  interests: Interest[];
}

const DEFAULT_FILTERS: Filters = { query: '', time: 'any', budget: 'any', energy: 'any', interests: [] };

const BUDGET_RANK: Record<Budget, number> = { free: 0, low: 1, flexible: 2 };
const ENERGY_RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 };

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: '10', label: 'Up to 10 min' },
  { value: '20', label: 'Up to 20 min' },
  { value: '30', label: 'Up to 30 min' },
  { value: '60', label: 'Up to 60 min' },
  { value: '120', label: '120+ min' },
];
const BUDGET_OPTIONS: { value: BudgetFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'free', label: 'Free only' },
  { value: 'low', label: 'Up to low-cost' },
  { value: 'flexible', label: 'Flexible' },
];
const ENERGY_OPTIONS: { value: EnergyFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Up to medium' },
  { value: 'high', label: 'High' },
];
const INTEREST_OPTIONS = INTEREST_IDS.map((id) => ({ value: id, label: INTEREST_META[id].label, icon: INTEREST_META[id].icon }));

function matches(activity: Activity, filters: Filters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = `${activity.title} ${activity.summary} ${activity.type}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.time !== 'any' && filters.time !== '120' && activity.minutes > Number(filters.time)) return false;
  if (filters.budget !== 'any' && BUDGET_RANK[activity.budget] > BUDGET_RANK[filters.budget]) return false;
  if (filters.energy !== 'any' && ENERGY_RANK[activity.energy] > ENERGY_RANK[filters.energy]) return false;
  if (filters.interests.length > 0 && !activity.interests.some((interest) => filters.interests.includes(interest))) return false;
  return true;
}

export function ActivityIdeas() {
  const { data, error, loading, reload } = useAsync(() => api.getActivities(), []);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(() => (data ?? []).filter((activity) => matches(activity, filters)), [data, filters]);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  function patch<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  return (
    <div>
      <h2 className="text-3xl font-medium">Activity ideas</h2>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-forest-700">
        {api.source === 'mock'
          ? 'Search sample activities by time, budget, energy and interest. These are demo content, not live listings.'
          : 'Search activities by time, budget, energy and interest.'}
      </p>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside aria-label="Filters" className="rounded-3xl bg-white p-5 shadow-card lg:sticky lg:top-24">
          <div className="flex items-center justify-between lg:hidden">
            <h2 className="font-body text-base font-semibold">Filters</h2>
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showFilters}
              aria-controls="filter-panel"
              onClick={() => setShowFilters((value) => !value)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </Button>
          </div>
          <div id="filter-panel" className={`${showFilters ? 'mt-5 block' : 'hidden'} space-y-6 lg:mt-0 lg:block`}>
            <FormField id="search" label="Search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-500" aria-hidden="true" />
                <input
                  id="search"
                  type="search"
                  className="input pl-10"
                  value={filters.query}
                  onChange={(event) => patch('query', event.target.value)}
                  placeholder="Birds, sketching, picnic"
                />
              </div>
            </FormField>
            <FormField id="f-time" legend label="Time available">
              <RadioChips name="f-time" options={TIME_OPTIONS} value={filters.time} onChange={(value) => patch('time', value)} />
            </FormField>
            <FormField id="f-budget" legend label="Budget">
              <RadioChips name="f-budget" options={BUDGET_OPTIONS} value={filters.budget} onChange={(value) => patch('budget', value)} />
            </FormField>
            <FormField id="f-energy" legend label="Energy needed">
              <RadioChips name="f-energy" options={ENERGY_OPTIONS} value={filters.energy} onChange={(value) => patch('energy', value)} />
            </FormField>
            <FormField id="f-interests" legend label="Interests">
              <CheckChips name="f-interests" options={INTEREST_OPTIONS} values={filters.interests} onChange={(values) => patch('interests', values)} />
            </FormField>
            <Button variant="ghost" size="sm" disabled={!isFiltered} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear all filters
            </Button>
          </div>
        </aside>

        <div>
          <p className="mb-4 text-sm text-forest-600" role="status" aria-live="polite">
            {loading ? 'Loading activities' : data ? `${results.length} of ${data.length} activities` : ''}
          </p>
          {loading && <CardGridSkeleton count={6} label="Loading activities" />}
          {error && <ErrorMessage message={error} onRetry={reload} />}
          {data && results.length === 0 && (
            <EmptyState
              icon={TreePine}
              title="No activities match those filters"
              description="Try a longer time, a bigger budget or fewer interests. Short, free, low-energy options are always a good place to start."
              action={<Button onClick={() => setFilters(DEFAULT_FILTERS)}>Clear all filters</Button>}
            />
          )}
          {data && results.length > 0 && (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((activity) => (
                <li key={activity.id}>
                  <ActivityCard activity={activity} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
