import { MotionConfig, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DemoBanner } from '../components/DemoBanner';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

export function RootLayout() {
  const { pathname, hash } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0 });
    // Move focus to the new page for keyboard and screen-reader users, but not on first load.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <DemoBanner />
        <Navbar />
        <motion.main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          key={pathname}
          className="flex-1 outline-none"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
