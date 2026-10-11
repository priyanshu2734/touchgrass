import { Accessibility, Clock, Lock, Trophy, Umbrella, type LucideIcon } from 'lucide-react';
import { Reveal } from '../Reveal';

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const FEATURES: Feature[] = [
  {
    icon: Clock,
    title: 'Plans sized to your actual day',
    text: 'Choose 10 to 120+ minutes, a free, low-cost or flexible budget, and low to high energy.',
  },
  {
    icon: Umbrella,
    title: 'A backup in every plan',
    text: 'If the weather or your mood changes, you already have a second option that fits the same limits.',
  },
  {
    icon: Accessibility,
    title: 'Accessibility is a filter, not a footnote',
    text: 'Ask for step-free routes, seating, shade, quiet places or short distances. They apply to every plan you generate.',
  },
  {
    icon: Trophy,
    title: 'Small quests that add up',
    text: 'Name three birds, take five photos of shadows, pick up ten pieces of litter. Finish one and it counts toward your progress.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    text: 'No account is needed. Location is optional, and if you share it, it is rounded to roughly a kilometre.',
  },
];

export function FeatureList() {
  return (
    <ul className="divide-y divide-forest-800/15 border-y border-forest-800/15">
      {FEATURES.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <li key={feature.title}>
            <Reveal delay={index * 0.04} className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sage-100 text-forest-800">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xl font-medium">{feature.title}</h3>
                <p className="mt-1.5 max-w-xl text-forest-700">{feature.text}</p>
              </div>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
