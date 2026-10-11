import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

interface SectionHeadingProps {
  title: string;
  description?: ReactNode;
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
}

export function SectionHeading({ title, description, as: Tag = 'h2', id, className }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <Tag id={id} className={cn('font-medium leading-tight text-forest-900', Tag === 'h1' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl')}>
        {title}
      </Tag>
      {description && <p className="mt-4 text-lg leading-relaxed text-forest-700">{description}</p>}
    </div>
  );
}
