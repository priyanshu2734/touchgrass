import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#1B3A29" />
      <g fill="none" stroke="#FBF7EE" strokeWidth="2.4" strokeLinecap="round">
        <path d="M16 25 C16 18 15.5 13 11 8" />
        <path d="M16 25 C16 17 17 12 16 6" />
        <path d="M16 25 C17 19 19.5 15 24 12" />
      </g>
      <circle cx="16" cy="26" r="1.6" fill="#E3792B" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2.5', className)} aria-label="TouchGrass home">
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight text-forest-900">TouchGrass</span>
    </Link>
  );
}
