import { describe, expect, it, jest } from '@jest/globals';

import { CARRIED_OVER_KEY, moveOffSupabase, type SecureKv, SUPABASE_KEY, supabaseUserId } from '@/auth/handover';
import { type CarriedOver, claimLocalData, newAccountWipesData } from '@/auth/owner';
import { accessStatus, accountCode, LOCK_AFTER_MS, passkeyName, shouldLock } from '@/auth/rules';
import { parseStoredSession } from '@/auth/session-core';

describe('rules', () => {
  it('locks only after a minute in the background', () => {
    expect(shouldLock(null, 1_000_000)).toBe(false);
    expect(shouldLock(1_000_000, 1_000_000 + LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldLock(1_000_000, 1_000_000 + LOCK_AFTER_MS)).toBe(true);
  });

  it('combines sign-in and the lock into one status', () => {
    const open = { loaded: true, locked: false };
    expect(accessStatus('loading', open)).toBe('loading');
    expect(accessStatus('signed-in', { loaded: false, locked: false })).toBe('loading');
    expect(accessStatus('signed-out', { loaded: true, locked: true })).toBe('signed-out');
    expect(accessStatus('signed-in', { loaded: true, locked: true })).toBe('locked');
    expect(accessStatus('signed-in', open)).toBe('signed-in');
  });

  it('shows the same short code the server puts in the passkey name', () => {
    // stepsinfra lambda_src/auth/index.mjs: `Steps ${userId.slice(0, 6).toUpperCase()}`
    expect(accountCode('3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44')).toBe('3F2A91');
    expect(passkeyName('3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44')).toBe('Steps 3F2A91');
    expect(accountCode('a_b')).toBe('A_B');
  });
});

describe('parseStoredSession', () => {
  const good = { userId: 'user-a', refreshToken: 'r'.repeat(43) };

  it('reads what the app saved', () => {
    expect(parseStoredSession(JSON.stringify(good))).toEqual(good);
  });

  it('treats anything else as signed out', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('not json')).toBeNull();
    expect(parseStoredSession('null')).toBeNull();
    expect(parseStoredSession(JSON.stringify({ userId: 'user-a' }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...good, refreshToken: 'short' }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...good, userId: 'a b' }))).toBeNull();
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

  /** The Supabase account a phone carried over to passkeys, as session-storage keeps it. */
  const carried = (id: string | null) => {
    let value = id;
    const clear = jest.fn(async () => {
      value = null;
    });
    const store: CarriedOver & { clear: typeof clear } = { get: async () => value, clear };
    return store;
  };

  it('gives the old Supabase account’s data to the first passkey account, once', async () => {
    const repo = repoWith('supabase-a');
    const wipe = jest.fn(async () => undefined);
    const handover = carried('supabase-a');
    expect(await newAccountWipesData(repo, handover)).toBe(false);
    await claimLocalData(repo, 'passkey-a', wipe, handover);
    expect(wipe).not.toHaveBeenCalled();
    expect(repo.kv.get('accountId')).toBe('passkey-a');
    expect(handover.clear).toHaveBeenCalledTimes(1);
    expect(await handover.get()).toBeNull();

    // Anyone after that is a different person again.
    expect(await newAccountWipesData(repo, handover)).toBe(true);
    await claimLocalData(repo, 'passkey-b', wipe, handover);
    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it('still wipes when the carried-over account isn’t the one whose data is here', async () => {
    const repo = repoWith('supabase-a');
    const wipe = jest.fn(async () => undefined);
    await claimLocalData(repo, 'passkey-b', wipe, carried('supabase-other'));
    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it('wipes when nobody was signed in with Supabase, or the note can’t be read', async () => {
    for (const handover of [carried(null), { get: async () => Promise.reject(new Error('keystore')), clear: async () => undefined }]) {
      const repo = repoWith('supabase-a');
      const wipe = jest.fn(async () => undefined);
      expect(await newAccountWipesData(repo, handover)).toBe(true);
      await claimLocalData(repo, 'passkey-a', wipe, handover);
      expect(wipe).toHaveBeenCalledTimes(1);
    }
  });

  it('warns only when a new account would wipe data', async () => {
    expect(await newAccountWipesData(repoWith(null))).toBe(false);
    expect(await newAccountWipesData(repoWith('passkey-a'))).toBe(true);
  });
});

describe('moving off Supabase', () => {
  const memoryKv = (entries: Record<string, string>) => {
    const kv = new Map(Object.entries(entries));
    const log: string[] = [];
    const store: SecureKv = {
      get: async (k) => kv.get(k) ?? null,
      set: async (k, v) => {
        log.push(`set ${k}`);
        kv.set(k, v);
      },
      remove: async (k) => {
        log.push(`remove ${k}`);
        kv.delete(k);
      },
    };
    return { kv, log, store };
  };
  const session = JSON.stringify({ access_token: 'secret', refresh_token: 'secret', user: { id: '3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44' } });

  it('notes who was signed in before deleting the old session', async () => {
    const { kv, log, store } = memoryKv({
      [`${SUPABASE_KEY}.n`]: '2',
      [`${SUPABASE_KEY}.0`]: session.slice(0, 40),
      [`${SUPABASE_KEY}.1`]: session.slice(40),
      'sb-hqzroexjsskwryylmccy-auth-token.n': '1',
      'sb-hqzroexjsskwryylmccy-auth-token.0': '{"user":{"id":"older-project"}}',
    });
    await moveOffSupabase(store);
    expect(kv.get(CARRIED_OVER_KEY)).toBe('3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44');
    expect(log[0]).toBe(`set ${CARRIED_OVER_KEY}`);
    // Every old key is gone, tokens included; only the note is left.
    expect([...kv.keys()]).toEqual([CARRIED_OVER_KEY]);
  });

  it('keeps everything when the note can’t be saved, to try again next start', async () => {
    const { kv, store } = memoryKv({ [`${SUPABASE_KEY}.n`]: '1', [`${SUPABASE_KEY}.0`]: session });
    store.set = async () => {
      throw new Error('keystore');
    };
    await expect(moveOffSupabase(store)).rejects.toThrow('keystore');
    expect(kv.get(`${SUPABASE_KEY}.0`)).toBe(session);
  });

  it('notes nobody for a missing, half-written or other session', async () => {
    const cases: Record<string, string>[] = [
      {},
      { [`${SUPABASE_KEY}.n`]: '2', [`${SUPABASE_KEY}.0`]: session },
      { 'sb-hqzroexjsskwryylmccy-auth-token.n': '1', 'sb-hqzroexjsskwryylmccy-auth-token.0': session },
    ];
    for (const entries of cases) {
      const { kv, store } = memoryKv(entries);
      await moveOffSupabase(store);
      expect([...kv.keys()]).toEqual([]);
    }
  });

  it('reads the account id out of a Supabase session', () => {
    expect(supabaseUserId(session)).toBe('3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44');
    expect(supabaseUserId(null)).toBeNull();
    expect(supabaseUserId('not json')).toBeNull();
    expect(supabaseUserId('{"user":{"id":"a b"}}')).toBeNull();
    expect(supabaseUserId('{"user":null}')).toBeNull();
  });
});
