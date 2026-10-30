import { describe, expect, it, jest } from '@jest/globals';

import { chunkedStorage, type SecureKv } from '@/auth/chunked-storage';
import { claimLocalData } from '@/auth/owner';
import { authMessage, isCode, isEmail, LOCK_AFTER_MS, normalizeEmail, passwordProblem, shouldLock } from '@/auth/rules';

function memoryKv(): SecureKv & { keys(): string[] } {
  const map = new Map<string, string>();
  return {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => {
      map.set(k, v);
    },
    remove: async (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()].sort(),
  };
}

describe('chunkedStorage', () => {
  it('round-trips a value longer than one chunk', async () => {
    const kv = memoryKv();
    const store = chunkedStorage(kv, 4);
    await store.setItem('sb', 'abcdefghij');
    expect(kv.keys()).toEqual(['sb.0', 'sb.1', 'sb.2', 'sb.n']);
    expect(await store.getItem('sb')).toBe('abcdefghij');
  });

  it('removes leftover parts when a value shrinks', async () => {
    const kv = memoryKv();
    const store = chunkedStorage(kv, 4);
    await store.setItem('sb', 'abcdefghij');
    await store.setItem('sb', 'xyz');
    expect(kv.keys()).toEqual(['sb.0', 'sb.n']);
    expect(await store.getItem('sb')).toBe('xyz');
  });

  it('reads a missing part as signed out, and removes everything', async () => {
    const kv = memoryKv();
    const store = chunkedStorage(kv, 4);
    expect(await store.getItem('sb')).toBeNull();
    await store.setItem('sb', 'abcdefgh');
    await kv.remove('sb.1');
    expect(await store.getItem('sb')).toBeNull();
    await store.removeItem('sb');
    expect(kv.keys()).toEqual([]);
  });
});

describe('rules', () => {
  it('checks emails, codes and passwords', () => {
    expect(normalizeEmail('  Ravi@Gmail.com ')).toBe('ravi@gmail.com');
    expect(isEmail('ravi@gmail.com')).toBe(true);
    expect(isEmail('ravi@gmail')).toBe(false);
    expect(isCode(' 123456 ')).toBe(true);
    expect(isCode('12345')).toBe(false);
    expect(isCode('12a456')).toBe(false);
    expect(passwordProblem('short')).toMatch('8 characters');
    expect(passwordProblem(' padded pass ')).toMatch('space');
    expect(passwordProblem('long enough')).toBeNull();
  });

  it('locks only after a minute in the background', () => {
    expect(shouldLock(null, 1_000_000)).toBe(false);
    expect(shouldLock(1_000_000, 1_000_000 + LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldLock(1_000_000, 1_000_000 + LOCK_AFTER_MS)).toBe(true);
  });

  it('turns Supabase errors into plain words', () => {
    expect(authMessage({ code: 'invalid_credentials', status: 400 })).toBe('Wrong email or password.');
    expect(authMessage({ name: 'AuthRetryableFetchError', status: 0 })).toMatch('No internet');
    expect(authMessage({ status: 429, message: 'x' })).toMatch('Too many tries');
    expect(authMessage({ code: 'otp_expired' })).toMatch('expired');
    expect(authMessage({ message: 'Your current password is wrong.' })).toBe('Your current password is wrong.');
    expect(authMessage(null)).toMatch('Something went wrong');
  });
});

describe('claimLocalData', () => {
  const repoWith = (owner: string | null) => {
    const kv = new Map<string, unknown>(owner ? [['accountId', owner]] : []);
    return {
      kv,
      getKv: async <T,>(k: string) => (kv.get(k) as T) ?? null,
      setKv: async <T,>(k: string, v: T) => {
        kv.set(k, v);
      },
    };
  };

  it('gives existing data to the first account without wiping', async () => {
    const repo = repoWith(null);
    const wipe = jest.fn(async () => undefined);
    await claimLocalData(repo, 'user-a', wipe);
    expect(wipe).not.toHaveBeenCalled();
    expect(repo.kv.get('accountId')).toBe('user-a');
  });

  it('wipes another account’s data first', async () => {
    const repo = repoWith('user-a');
    const wipe = jest.fn(async () => undefined);
    await claimLocalData(repo, 'user-b', wipe);
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(repo.kv.get('accountId')).toBe('user-b');
    await claimLocalData(repo, 'user-b', wipe);
    expect(wipe).toHaveBeenCalledTimes(1);
  });
});
