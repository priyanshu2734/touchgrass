import { beforeEach, describe, expect, it } from 'vitest';
import { getProfileId, isValidProfileId } from './profile';

beforeEach(() => window.localStorage.clear());

describe('getProfileId', () => {
  it('creates a random id the backend will accept, and keeps it', () => {
    const first = getProfileId();
    expect(isValidProfileId(first)).toBe(true);
    expect(getProfileId()).toBe(first);
    expect(window.localStorage.getItem('touchgrass.profile')).toBe(first);
  });
  it('replaces a stored value the backend would reject', () => {
    window.localStorage.setItem('touchgrass.profile', 'bad id!');
    const id = getProfileId();
    expect(isValidProfileId(id)).toBe(true);
    expect(id).not.toBe('bad id!');
  });
  it('different browsers get different ids', () => {
    const a = getProfileId();
    window.localStorage.clear();
    expect(getProfileId()).not.toBe(a);
  });
});

describe('isValidProfileId', () => {
  it.each([['abcd1234', true], ['short', false], ['has space here', false], ['a'.repeat(65), false], ['A_b-c_1234', true]])('%s -> %s', (value, ok) => {
    expect(isValidProfileId(value)).toBe(ok);
  });
});
