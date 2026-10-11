import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ActivityCard } from '../components/ActivityCard';
import { ButtonLink } from '../components/Button';
import { Counter } from '../components/Counter';
import { ErrorMessage } from '../components/ErrorMessage';
import { CardGridSkeleton } from '../components/LoadingState';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { BarrierTabs } from '../components/landing/BarrierTabs';
import { FeatureList } from '../components/landing/FeatureList';
import { HowItWorks } from '../components/landing/HowItWorks';
import { TrailMap } from '../components/landing/TrailMap';
import { INTEREST_IDS } from '../data/options';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';

const REASSURANCES = ['No account needed', 'Location is optional', 'Every plan has a backup', 'Open-weight AI, with a labelled fallback'];

const HERO_PARENT = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const HERO_CHILD = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };

export function LandingPage() {
  useDocumentTitle(
    'TouchGrass',
    'TouchGrass turns the time, budget and energy you actually have into a realistic plan for going outside, with a backup option and no account required.',
  );
  const activities = useAsync(() => api.getActivities(), []);
  const quests = useAsync(() => api.getQuests(), []);

  return (
    <>
      <section className="container-page grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:py-20">
        <motion.div variants={HERO_PARENT} initial="hidden" animate="show">
          <motion.h1 variants={HERO_CHILD} className="text-5xl font-medium leading-[1.05] sm:text-6xl lg:text-7xl">
            Less scrolling. More living.
          </motion.h1>
          <motion.p variants={HERO_CHILD} className="mt-6 max-w-xl text-xl leading-relaxed text-forest-700">
            TouchGrass turns the time, budget and energy you actually have into a realistic plan for stepping outside,
            with a backup ready in case the day does not cooperate.
          </motion.p>
          <motion.div variants={HERO_CHILD} className="mt-9 flex flex-wrap gap-3">
            <ButtonLink to="/plan" size="lg" variant="accent">
              Plan my next adventure
            </ButtonLink>
            <ButtonLink to="/quests" size="lg" variant="secondary">
              Explore outdoor quests
            </ButtonLink>
            <ButtonLink to="/explore" size="lg" variant="ghost">
              Browse places nearby
            </ButtonLink>
          </motion.div>
          <motion.ul variants={HERO_CHILD} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-forest-700">
            {REASSURANCES.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-forest-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </motion.ul>
        </motion.div>
        <TrailMap />
      </section>

      <section className="bg-cream-200/60 py-20" aria-labelledby="barriers-heading">
        <div className="container-page">
          <SectionHeading
            id="barriers-heading"
            title="Going outside is easier when the decisions are already made"
            description="Most of the time, the hard part is not the walk. It is deciding what to do, how long it will take and what to do if it goes wrong. Pick what usually gets in the way."
          />
          <div className="mt-10">
            <BarrierTabs />
          </div>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="features-heading">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              id="features-heading"
              title="Built around real constraints"
              description="TouchGrass starts from what limits people, not from an ideal weekend."
            />
          </div>
          <div>
            <FeatureList />
          </div>
        </div>
      </section>

      <section className="bg-forest-800 py-20 text-cream-50" aria-labelledby="examples-heading">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 id="examples-heading" className="text-3xl font-medium text-cream-50 sm:text-4xl">
              A few things you could do this week
            </h2>
            <p className="mt-4 text-lg text-cream-200">
              {api.source === 'mock'
                ? 'These are sample activities bundled with the demo. They are not live listings.'
                : 'Activities from the TouchGrass catalogue.'}
            </p>
          </div>
          <div className="mt-10">
            {activities.loading && <CardGridSkeleton count={3} label="Loading activities" />}
            {activities.error && <ErrorMessage message={activities.error} onRetry={activities.reload} />}
            {activities.data && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {activities.data.filter((_, index) => index % 5 === 0).slice(0, 3).map((activity) => (
                  <Reveal key={activity.id}>
                    <ActivityCard activity={activity} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
          <div className="mt-10">
            <ButtonLink to="/explore" variant="accent">
              Browse all activities
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="how-heading">
        <SectionHeading id="how-heading" title="How it works" description="Three steps, and the first one takes about a minute." />
        <div className="mt-10">
          <HowItWorks />
        </div>
      </section>

      <section className="container-page pb-4" aria-labelledby="catalogue-heading">
        <h2 id="catalogue-heading" className="sr-only">
          What is in the catalogue
        </h2>
        <dl className="grid grid-cols-2 gap-6 rounded-3xl border border-forest-800/15 bg-cream-50 p-8 sm:grid-cols-4">
          {[
            { label: api.source === 'mock' ? 'sample activities' : 'activities', value: activities.data?.length ?? 0 },
            { label: api.source === 'mock' ? 'sample quests' : 'quests', value: quests.data?.length ?? 0 },
            { label: 'interests to filter by', value: INTEREST_IDS.length },
            { label: 'minutes is the shortest plan', value: 10 },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-forest-600">{stat.label}</dt>
              <dd className="font-display text-4xl font-medium text-forest-900">
                <Counter value={stat.value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="container-page py-20">
        <div className="rounded-[2rem] bg-sage-100 px-8 py-14 text-center sm:px-14">
          <h2 className="mx-auto max-w-2xl text-3xl font-medium sm:text-4xl">Ten minutes is a real start.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-forest-700">
            Tell the planner how much time you have and it will do the deciding.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/plan" size="lg" variant="primary">
              Plan my next adventure
            </ButtonLink>
            <ButtonLink to="/about" size="lg" variant="secondary">
              Why TouchGrass
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
