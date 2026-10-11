import { cn } from '../utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-forest-800/10', className)} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center gap-3 text-forest-700', className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest-800/30 border-t-forest-800" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function CardGridSkeleton({ count = 6, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-card">
            <Skeleton className="h-32 rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
