import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-forest-800 text-cream-50 hover:bg-forest-700 active:bg-forest-900',
  accent: 'bg-ember-500 text-forest-950 hover:bg-ember-300 active:bg-ember-600',
  secondary: 'border border-forest-800/30 bg-cream-50 text-forest-800 hover:border-forest-800 hover:bg-white',
  ghost: 'text-forest-800 hover:bg-forest-800/10',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-14 px-7 text-base',
};

export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonStyles(variant, size, className)} {...rest} />;
}
