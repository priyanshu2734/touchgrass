import { Link } from 'react-router-dom';
import { USE_MOCK } from '../services/config';
import { Logo } from './Logo';

const EXPLORE = [
  { to: '/plan', label: 'Activity planner' },
  { to: '/explore', label: 'Explore activities' },
  { to: '/quests', label: 'Outdoor quests' },
  { to: '/progress', label: 'My progress' },
];
const ABOUT = [
  { to: '/about', label: 'Why TouchGrass' },
  { to: '/about#privacy', label: 'Privacy approach' },
  { to: '/about#status', label: 'What is real in this build' },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-forest-950 text-cream-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo className="[&_span]:text-cream-50" />
          <p className="mt-4 max-w-sm text-cream-200">Less scrolling. More living.</p>
          <p className="mt-6 max-w-sm text-sm text-cream-300/80">
            An open-source project built on open-weight AI and open map data. Plans are suggestions, not professional advice. Check conditions,
            routes and your own limits before heading out.
          </p>
        </div>
        <nav aria-label="Explore">
          <h2 className="font-body text-sm font-semibold text-cream-50">Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {EXPLORE.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="About">
          <h2 className="font-body text-sm font-semibold text-cream-50">About</h2>
          <ul className="mt-4 space-y-2.5">
            {ABOUT.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-sm text-cream-300/80">
          Data source: {USE_MOCK ? 'built-in sample data (demo mode)' : 'live TouchGrass backend'}
        </p>
      </div>
    </footer>
  );
}
