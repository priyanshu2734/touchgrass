import { Clock, CloudRain, Compass, Zap, type LucideIcon } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../utils/cn';
import { Badge } from '../Badge';
import { ButtonLink } from '../Button';

interface Barrier {
  id: string;
  label: string;
  icon: LucideIcon;
  answer: string;
  detail: string;
  chips: string[];
  to: string;
}

const BARRIERS: Barrier[] = [
  {
    id: 'time',
    label: 'I only have ten minutes',
    icon: Clock,
    answer: 'Ten minutes is a real plan.',
    detail:
      'Choose 10 minutes and you get one small thing with nothing to prepare: a lap of the block, a bench, a look at the sky.',
    chips: ['10 min', 'Free', 'Nothing to pack'],
    to: '/plan?minutes=10&energy=low',
  },
  {
    id: 'energy',
    label: 'I am worn out',
    icon: Zap,
    answer: 'Low energy has its own plans.',
    detail:
      'Set your energy to low and plans stay slow and seated where possible. Add accessibility needs and they apply to every suggestion.',
    chips: ['Low energy', 'Seating nearby', 'Short distances'],
    to: '/plan?energy=low',
  },
  {
    id: 'ideas',
    label: 'I never know what to do',
    icon: Compass,
    answer: 'You get one plan, not forty options.',
    detail:
      'Pick the interests you already have, like birds, photos or plants. The planner returns a single plan with a short checklist.',
    chips: ['One plan', 'Short checklist', 'Your interests'],
    to: '/plan',
  },
  {
    id: 'weather',
    label: 'What if the weather turns?',
    icon: CloudRain,
    answer: 'Every plan comes with a backup.',
    detail:
      'The backup fits the same time and energy, so changing your mind does not mean giving up on going outside.',
    chips: ['Backup included', 'Same time budget'],
    to: '/plan',
  },
];

export function BarrierTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = BARRIERS[activeIndex];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % BARRIERS.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + BARRIERS.length) % BARRIERS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = BARRIERS.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div role="tablist" aria-label="What usually gets in the way" aria-orientation="vertical" className="flex flex-col gap-2">
        {BARRIERS.map((barrier, index) => {
          const selected = index === activeIndex;
          const Icon = barrier.icon;
          return (
            <button
              key={barrier.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`barrier-tab-${barrier.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`barrier-panel-${barrier.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-lg font-medium transition-colors',
                selected
                  ? 'border-forest-800 bg-forest-800 text-cream-50'
                  : 'border-forest-800/20 bg-cream-50 text-forest-800 hover:border-forest-800/50',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {barrier.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`barrier-panel-${active.id}`}
        aria-labelledby={`barrier-tab-${active.id}`}
        className="rounded-3xl bg-white p-7 shadow-card sm:p-9"
      >
        <h3 className="text-2xl font-medium sm:text-3xl">{active.answer}</h3>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-forest-700">{active.detail}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {active.chips.map((chip) => (
            <Badge key={chip} tone="sage">
              {chip}
            </Badge>
          ))}
        </div>
        <ButtonLink to={active.to} variant="primary" className="mt-8">
          Try it in the planner
        </ButtonLink>
      </div>
    </div>
  );
}
