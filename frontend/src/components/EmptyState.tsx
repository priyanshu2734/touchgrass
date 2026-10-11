import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-forest-800/30 bg-cream-50/70 px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sage-100 text-forest-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-xl font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-forest-700">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
