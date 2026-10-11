/**
 * Anonymous profile id. There are no accounts: this random id is created in the browser, kept in localStorage and
 * sent as `X-Profile-Id` so the backend can keep one browser's progress separate from another's. It contains no
 * personal information and can be reset by clearing site data. Falls back to an in-memory id if storage is blocked.
 */
const KEY = 'touchgrass.profile';
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

let memoryId: string | null = null;

function generate(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getProfileId(): string {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && VALID.test(stored)) return stored;
    const created = generate();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    memoryId ??= generate();
    return memoryId;
  }
}

export function isValidProfileId(value: string): boolean {
  return VALID.test(value);
}
