import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ title = 'Something went wrong', message, onRetry }: ErrorMessageProps) {
  return (
    <div role="alert" className="rounded-2xl border border-ember-600/40 bg-ember-100/60 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ember-700" aria-hidden="true" />
        <div>
          <h3 className="font-body text-base font-semibold text-forest-950">{title}</h3>
          <p className="mt-1 text-forest-800">{message}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
