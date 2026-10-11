import { Reveal } from '../Reveal';

const STEPS = [
  {
    title: 'Tell us about your day',
    text: 'Pick your time, budget, energy, interests and company. Add accessibility needs if you have any.',
  },
  {
    title: 'Get a plan with a backup',
    text: 'You receive one plan with a duration, an estimated cost, a short checklist and a second option.',
  },
  {
    title: 'Go, then log a quest',
    text: 'Head out, then finish a quest to build a streak and see your outdoor minutes add up.',
  },
];

export function HowItWorks() {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.title}>
          <Reveal delay={index * 0.08} className="h-full rounded-3xl border border-forest-800/15 bg-cream-50 p-7">
            <span className="font-display text-4xl font-medium text-ember-600" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="mt-3 text-xl font-medium">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-2 text-forest-700">{step.text}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
