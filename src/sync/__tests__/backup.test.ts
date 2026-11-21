import { afterEach, beforeEach, describe, expect, jest } from '@jest/globals';

import { AuthApiError } from '@/auth/auth-api';
import type { Repository } from '@/data/types';
import {
  flushBackup,
  LAST_KEY,
  onBackupRestored,
  POST_TIMEOUT_MS,
  RESTORED_KEY,
  saveProfileChange,
  setBackupAccount,
  useBackupStatus,
} from '@/sync/backup';
import { type BackupRecord, PROFILE_EDITS_KEY } from '@/sync/backup-core';
import { backupLine, type BackupStatus, RESTORING_LINE } from '@/sync/backup-line';

import { fakeServer, newPhone, type Phone, rowInsert, withSqlite } from './backup-sqlite';

// Hoisted above the imports by babel-jest; used only inside the tests.
const mockFetch = jest.fn<(url: string, init: { method: string; body?: string }) => Promise<unknown>>();
const mockAppState: { listener: ((s: string) => void) | null; currentState: string } = { listener: null, currentState: 'active' };
jest.mock('@/auth/session', () => ({ authFetch: (url: string, init: { method: string; body?: string }) => mockFetch(url, init) }));
jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mockAppState.currentState;
    },
    addEventListener: (_: string, listener: (s: string) => void) => {
      mockAppState.listener = listener;
      return { remove: () => (mockAppState.listener = null) };
    },
  },
}));

const response = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

/** The phone's repository as far as the backup needs it: kv and sql. */
function repoOf(phone: Phone): Repository {
  return {
    sql: phone.sql,
    async getKv<T>(key: string) {
      const [row] = phone.all<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
      return row ? (JSON.parse(row.value) as T) : null;
    },
    async setKv(key: string, value: unknown) {
      phone.db
        .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run(key, JSON.stringify(value));
    },
  } as unknown as Repository;
}

/** Lets the engine's promises run (the SQLite here is synchronous underneath). */
const settle = async () => {
  for (let i = 0; i < 50; i++) await new Promise<void>((r) => setImmediate(() => r()));
};

/** steps-data behind mockFetch; `fail` answers every call instead while set. */
function serve(server = fakeServer()) {
  const state: { fail: (() => unknown) | null; gets: number; posts: number } = { fail: null, gets: 0, posts: 0 };
  mockFetch.mockImplementation(async (url, init) => {
    if (state.fail) return state.fail();
    if (init.method === 'POST') {
      state.posts++;
      const { records } = JSON.parse(init.body!) as { records: BackupRecord[] };
      return response(200, { saved: records.length, ...(await server.post(records)) });
    }
    state.gets++;
    const after = /after=([^&]+)/.exec(url)?.[1] ?? null;
    return response(200, await server.get(after ? decodeURIComponent(after) : null));
  });
  return { server, state };
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  mockFetch.mockReset();
  mockAppState.currentState = 'active';
});

afterEach(() => {
  setBackupAccount(null, null);
  jest.useRealTimers();
});

// The status store, read the way useBackupStatus does (without React).
jest.mock('react', () => ({
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));

/** The status as a screen reads it (React's store hook stubbed above). */
const useCurrent = () => useBackupStatus();
const current = useCurrent;

describe('backup engine', () => {
  withSqlite('signed in on a new phone: brings the backup back once, then uploads what changes', async () => {
    const { server, state } = serve();
    await server.post([{ t: 'weight_log', k: 'w1', u: 1000, d: { id: 'w1', logged_at: 1, value: 70 } }]);
    const phone = await newPhone();
    const repo = repoOf(phone);
    const restored = jest.fn();
    const off = onBackupRestored(restored);
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(state.gets).toBe(1);
    expect(restored).toHaveBeenCalledTimes(1);
    expect(phone.all('SELECT id FROM weight_log')).toEqual([{ id: 'w1' }]);
    expect(await repo.getKv(RESTORED_KEY)).toBe('user-1');
    expect(current()).toMatchObject({ phase: 'done', pending: 0 });
    expect(typeof (await repo.getKv(LAST_KEY))).toBe('number');

    // A change goes up once things have been quiet for a while.
    phone.db.exec(rowInsert(phone.db, 'mood_log', { date: '2026-11-20', mood: 4 }));
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(state.posts).toBe(0);
    jest.setSystemTime(Date.now() + 30_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(state.posts).toBe(1);
    expect([...server.stored.values()].map((r) => r.k).sort()).toEqual(['2026-11-20', 'w1']);

    // The next start: not restored again.
    setBackupAccount(null, null);
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(state.gets).toBe(1);
    expect(restored).toHaveBeenCalledTimes(1);
    off();
  });

  withSqlite('shows the restore on Today and the account card while it runs', async () => {
    const { state } = serve();
    let release: () => void = () => undefined;
    state.fail = () => new Promise((resolve) => (release = () => resolve(response(200, { records: [], next: null }))));
    const phone = await newPhone();
    setBackupAccount(repoOf(phone), 'user-1');
    await settle();
    expect(current().phase).toBe('restoring');
    expect(backupLine(current())).toBe(RESTORING_LINE);
    release();
    state.fail = null;
    await settle();
    expect(current().phase).toBe('done');
  });

  withSqlite('offline: says so, keeps the queue, and waits longer after each failure', async () => {
    const { state } = serve();
    const phone = await newPhone();
    const repo = repoOf(phone);
    await repo.setKv(RESTORED_KEY, 'user-1');
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    state.fail = () => Promise.reject(new AuthApiError('offline'));
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(current()).toMatchObject({ phase: 'offline', pending: 1 });
    expect(backupLine(current())).toBe('Not backed up yet: no connection');
    const tries = mockFetch.mock.calls.length;

    // Within the first back-off (30 s), the checks don't try again.
    jest.setSystemTime(Date.now() + 5_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(mockFetch.mock.calls.length).toBe(tries);

    // Past it, and back online: it goes up.
    state.fail = null;
    jest.setSystemTime(Date.now() + 40_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(state.posts).toBe(1);
    expect(phone.queue()).toEqual([]);
    expect(current().phase).toBe('done');
  });

  withSqlite('a 401 stops it until the next sign-in', async () => {
    const { state } = serve();
    const phone = await newPhone();
    const repo = repoOf(phone);
    await repo.setKv(RESTORED_KEY, 'user-1');
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    state.fail = () => response(401, {});
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(current().phase).toBe('off');
    const tries = mockFetch.mock.calls.length;
    mockAppState.listener?.('active');
    jest.setSystemTime(Date.now() + 60 * 60_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(mockFetch.mock.calls.length).toBe(tries);
    expect(phone.queue()).toHaveLength(1);
  });

  withSqlite('a reset brings nothing back until the next start, and never deletes the backup', async () => {
    const { server, state } = serve();
    const phone = await newPhone();
    const repo = repoOf(phone);
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(server.stored.size).toBe(1);

    phone.clearAll();
    phone.db.exec(rowInsert(phone.db, 'water_log', { id: 'g1' }));
    jest.setSystemTime(Date.now() + 60_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(state.gets).toBe(1);
    expect(phone.all('SELECT id FROM weight_log')).toEqual([]);
    expect([...server.stored.values()].every((r) => r.d !== null)).toBe(true);

    // The next start: the backup comes back, then the new change goes up.
    setBackupAccount(null, null);
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(state.gets).toBe(2);
    expect(phone.all('SELECT id FROM weight_log')).toEqual([{ id: 'w1' }]);
    expect([...server.stored.values()].map((r) => r.k).sort()).toEqual(['g1', 'w1']);
  });

  withSqlite('sign-out sends what is waiting first, and gives up after a few seconds', async () => {
    const { server, state } = serve();
    const phone = await newPhone();
    const repo = repoOf(phone);
    setBackupAccount(repo, 'user-1');
    await settle();
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    await flushBackup();
    expect([...server.stored.values()].map((r) => r.k)).toEqual(['w1']);

    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w2' }));
    // The call hangs (authFetch gives up after 20 s); sign-out doesn't wait for it.
    state.fail = () => new Promise((_, reject) => setTimeout(() => reject(new AuthApiError('offline')), 20_000));
    const flushed = flushBackup(4000);
    await settle();
    jest.advanceTimersByTime(4000);
    await expect(flushed).resolves.toBeUndefined();
    jest.advanceTimersByTime(20_000);
    await settle();
    expect(current().phase).toBe('offline');
  });

  withSqlite('no backup without an account, or without SQLite (web)', async () => {
    serve();
    const phone = await newPhone();
    setBackupAccount(repoOf(phone), null);
    await settle();
    setBackupAccount({ getKv: async () => null } as unknown as Repository, 'user-1');
    await settle();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(backupLine(current())).toBeNull();
  });

  withSqlite('a run for the account before never calls with the next one', async () => {
    const { state } = serve();
    let release: () => void = () => undefined;
    state.fail = () => new Promise((resolve) => (release = () => resolve(response(200, { records: [], next: 'more' }))));
    const phone = await newPhone();
    setBackupAccount(repoOf(phone), 'user-1');
    await settle();
    const tries = mockFetch.mock.calls.length;
    setBackupAccount(null, null);
    state.fail = null;
    release();
    await settle();
    expect(mockFetch.mock.calls.length).toBe(tries);
  });

  withSqlite('a profile change made while the backup comes back is laid over it, and goes up', async () => {
    const server = fakeServer(1);
    const backed = { heightCm: 180, dailyGoal: 9000, units: 'imperial', onboarded: true };
    await server.post([
      { t: 'kv', k: 'profile', u: 5000, d: { key: 'profile', value: JSON.stringify(backed) } },
      { t: 'weight_log', k: 'w1', u: 5000, d: { id: 'w1', logged_at: 1, value: 70 } },
    ]);
    const { state } = serve(server);
    const answer = mockFetch.getMockImplementation()!;
    // Each page waits until it is let through.
    const pages: (() => void)[] = [];
    mockFetch.mockImplementation(async (url, init) => {
      if (init.method === 'GET') await new Promise<void>((r) => pages.push(r));
      return answer(url, init);
    });
    const phone = await newPhone();
    const repo = repoOf(phone);
    const restored = jest.fn();
    const off = onBackupRestored(restored);
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(pages).toHaveLength(1);

    // Onboarding is answered before the backup's profile arrives.
    await saveProfileChange(repo, { dailyGoal: 12000 }, { onboarded: true });
    expect(await repo.getKv(PROFILE_EDITS_KEY)).toEqual({ dailyGoal: 12000 });

    // The profile's page: the app hears at once (before the rest), and both are kept.
    pages.shift()!();
    await settle();
    expect(pages).toHaveLength(1);
    expect(restored).toHaveBeenCalledTimes(1);
    const profile = await repo.getKv<Record<string, unknown>>('profile');
    expect(profile).toMatchObject({ heightCm: 180, units: 'imperial', dailyGoal: 12000, onboarded: true });

    pages.shift()!();
    await settle();
    expect(restored).toHaveBeenCalledTimes(2);
    expect(await repo.getKv(PROFILE_EDITS_KEY)).toBeNull();
    expect(current().phase).not.toBe('restoring');

    // The merged profile goes up (later than the backup's copy), without a name.
    jest.setSystemTime(Date.now() + 30_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    expect(state.posts).toBeGreaterThan(0);
    const up = server.stored.get('kv profile')!;
    expect(up.u).toBeGreaterThan(5000);
    const sent = JSON.parse((up.d as { value: string }).value) as Record<string, unknown>;
    expect(sent).toMatchObject({ heightCm: 180, dailyGoal: 12000 });
    expect('name' in sent).toBe(false);
    off();
  });

  withSqlite('a change once the backup is back is saved as is, with nothing kept for later', async () => {
    serve();
    const phone = await newPhone();
    const repo = repoOf(phone);
    await repo.setKv(RESTORED_KEY, 'user-1');
    setBackupAccount(repo, 'user-1');
    await settle();
    await saveProfileChange(repo, { weightKg: 80 });
    expect(await repo.getKv(PROFILE_EDITS_KEY)).toBeNull();
    expect(await repo.getKv('profile')).toMatchObject({ weightKg: 80, weightSet: true });
  });

  withSqlite('a slow link: the upload gives up after a while, then goes on in smaller batches', async () => {
    const { server } = serve();
    const answer = mockFetch.getMockImplementation()!;
    const phone = await newPhone();
    const repo = repoOf(phone);
    await repo.setKv(RESTORED_KEY, 'user-1');
    const note = 'n'.repeat(1500);
    for (let i = 0; i < 150; i++) {
      phone.db.exec(rowInsert(phone.db, 'mood_log', { date: `2026-01-${String(i).padStart(3, '0')}`, mood: 3, note }));
    }
    let hang = true;
    const sizes: number[] = [];
    mockFetch.mockImplementation(async (url, init) => {
      const { signal } = init as { signal?: AbortSignal };
      if (init.method === 'POST') {
        // Each call brings its own time limit (authFetch's own 20 s is too short for a full batch on a slow link).
        expect(signal).toBeDefined();
        sizes.push(init.body!.length);
        if (hang) {
          return new Promise((_, reject) => signal!.addEventListener('abort', () => reject(new AuthApiError('offline'))));
        }
      }
      return answer(url, init);
    });
    setBackupAccount(repo, 'user-1');
    await settle();
    expect(sizes).toHaveLength(1);
    expect(sizes[0]).toBeGreaterThan(100_000);

    jest.advanceTimersByTime(POST_TIMEOUT_MS);
    await settle();
    expect(current().phase).toBe('offline');

    hang = false;
    jest.setSystemTime(Date.now() + 40_000);
    jest.advanceTimersByTime(10_000);
    await settle();
    // Half the size after the timeout, then larger again once a batch has gone through.
    expect(sizes[1]).toBeLessThanOrEqual(100_000);
    expect(sizes[2]).toBeGreaterThan(sizes[1]);
    expect(phone.queue()).toEqual([]);
    expect(server.stored.size).toBe(150);
    expect(current().phase).toBe('done');
  });
});

describe('backup line', () => {
  const now = 10 * 60 * 60_000;
  const s = (phase: BackupStatus['phase'], lastAt: number | null, pending = 0): BackupStatus => ({ phase, lastAt, pending });
  withSqlite('says when the data was last backed up, or why not', () => {
    expect(backupLine(s('off', now), now)).toBeNull();
    expect(backupLine(s('waiting', null), now)).toBe('Not backed up yet');
    expect(backupLine(s('waiting', now - 5 * 60_000), now)).toBe('Backed up: 5 min ago');
    expect(backupLine(s('uploading', now), now)).toBe('Backing up…');
    expect(backupLine(s('restoring', null), now)).toBe(RESTORING_LINE);
    expect(backupLine(s('done', now - 10_000), now)).toBe('Backed up: just now');
    expect(backupLine(s('offline', now - 2 * 60 * 60_000), now)).toBe('Backed up: 2 h ago');
    expect(backupLine(s('offline', now, 3), now)).toBe('Not backed up yet: no connection');
    expect(backupLine(s('failed', null), now)).toBe('Not backed up yet: trying again soon');
  });
});
