import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';
import { ButtonLink } from './Button';
import { Logo } from './Logo';

const LINKS = [
  { to: '/plan', label: 'Planner' },
  { to: '/explore', label: 'Explore' },
  { to: '/quests', label: 'Quests' },
  { to: '/progress', label: 'My progress' },
  { to: '/about', label: 'About' },
];

function linkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'rounded-sm px-1 py-1 text-[15px] font-medium transition-colors',
    isActive
      ? 'text-forest-950 underline decoration-ember-500 decoration-2 underline-offset-[10px]'
      : 'text-forest-700 hover:text-forest-950',
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-forest-800/10 bg-cream-100/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block">
          <ButtonLink to="/plan" size="sm" variant="primary">
            Plan my next adventure
          </ButtonLink>
        </div>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full text-forest-900 hover:bg-forest-800/10 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            className="border-t border-forest-800/10 bg-cream-50 lg:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="container-page flex flex-col gap-1 py-4">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-3 py-3 text-lg font-medium',
                      isActive ? 'bg-sage-100 text-forest-950' : 'text-forest-800 hover:bg-forest-800/5',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <ButtonLink to="/plan" size="lg" className="mt-3">
                Plan my next adventure
              </ButtonLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
