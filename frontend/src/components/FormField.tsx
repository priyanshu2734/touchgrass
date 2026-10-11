import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

interface FormFieldProps {
  /** Base id. Used for the control (label mode) and for the hint/error ids. */
  id: string;
  label: string;
  /** Render a fieldset + legend for groups of radios/checkboxes. */
  legend?: boolean;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function hintId(id: string): string {
  return `${id}-hint`;
}
export function errorId(id: string): string {
  return `${id}-error`;
}

export function FormField({ id, label, legend = false, hint, error, optional = false, className, children }: FormFieldProps) {
  const labelText = (
    <>
      {label}
      {optional && <span className="font-normal text-forest-600"> (optional)</span>}
    </>
  );
  const hintNode = hint ? (
    <p id={hintId(id)} className="mt-0.5 text-sm text-forest-600">
      {hint}
    </p>
  ) : null;
  const errorNode = error ? (
    <p id={errorId(id)} role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-ember-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null;

  if (legend) {
    return (
      <fieldset className={cn('min-w-0', className)}>
        <legend className="text-base font-semibold text-forest-900">{labelText}</legend>
        {hintNode}
        <div className="mt-3">{children}</div>
        {errorNode}
      </fieldset>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-base font-semibold text-forest-900">
        {labelText}
      </label>
      {hintNode}
      <div className="mt-2">{children}</div>
      {errorNode}
    </div>
  );
}
