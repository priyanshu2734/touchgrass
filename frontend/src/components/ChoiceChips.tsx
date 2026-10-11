import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '../utils/cn';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

const CHIP_BASE =
  'inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember-500 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-cream-100';
const CHIP_ON = 'border-forest-800 bg-forest-800 text-cream-50';
const CHIP_OFF = 'border-forest-800/25 bg-cream-50 text-forest-800 hover:border-forest-800/60';

interface RadioChipsProps<T extends string | number> {
  name: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  describedBy?: string;
}

export function RadioChips<T extends string | number>({ name, options, value, onChange, describedBy }: RadioChipsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-describedby={describedBy}>
      {options.map((option) => {
        const id = `${name}-${String(option.value)}`;
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <label key={id} htmlFor={id} className={cn(CHIP_BASE, checked ? CHIP_ON : CHIP_OFF)}>
            <input
              id={id}
              type="radio"
              name={name}
              value={String(option.value)}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

interface CheckChipsProps<T extends string> {
  name: string;
  options: ChipOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  describedBy?: string;
  invalid?: boolean;
}

export function CheckChips<T extends string>({ name, options, values, onChange, describedBy, invalid }: CheckChipsProps<T>) {
  function toggle(value: T) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const checked = values.includes(option.value);
        const Icon = option.icon;
        return (
          <label
            key={id}
            htmlFor={id}
            className={cn(CHIP_BASE, checked ? CHIP_ON : CHIP_OFF, invalid && !checked && 'border-ember-600')}
          >
            <input
              id={id}
              type="checkbox"
              name={name}
              checked={checked}
              onChange={() => toggle(option.value)}
              aria-describedby={describedBy}
              className="sr-only"
            />
            {checked ? <Check className="h-4 w-4" aria-hidden="true" /> : Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
