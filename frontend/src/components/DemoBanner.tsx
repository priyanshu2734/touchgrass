import { Info } from 'lucide-react';
import { USE_MOCK } from '../services/config';

/** Visible whenever the app is running on built-in sample data. */
export function DemoBanner() {
  if (!USE_MOCK) return null;
  return (
    <div className="bg-forest-950 text-cream-100">
      <p className="container-page flex items-start gap-2 py-2 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ember-300" aria-hidden="true" />
        <span>
          Demo mode: activities are sample content, quests are the curated list, plans come from simple built-in rules (not AI),
          progress is saved only in this browser, and nearby places are a fixed sample in London, not your area.
        </span>
      </p>
    </div>
  );
}
