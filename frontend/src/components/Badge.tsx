import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type Tone = 'neutral' | 'forest' | 'ember' | 'sage';

const TONES: Record<Tone, string> = {
  neutral: 'bg-cream-200 text-forest-800',
  forest: 'bg-forest-800 text-cream-50',
  ember: 'bg-ember-100 text-ember-700',
  sage: 'bg-sage-100 text-forest-800',
};

interface BadgeProps {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}
