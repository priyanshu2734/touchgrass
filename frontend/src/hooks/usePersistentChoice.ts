import { useCallback, useState } from 'react';

/** A tiny remembered preference (never anything personal). Falls back to memory if storage is unavailable. */
export function usePersistentChoice<T extends string>(key: string, fallback: T, isValid: (value: unknown) => value is T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return isValid(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* ignore: preference just will not persist */
      }
    },
    [key],
  );
  return [value, update];
}
