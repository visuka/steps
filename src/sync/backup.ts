/**
 * When the cloud backup runs (docs/backup.md): signed in, at start, when the
 * app comes to the front, and a short quiet while after changes (sync_queue
 * is looked at every few seconds while the app is open). One run at a time;
 * failures wait longer each time; a 401 stops it until the next sign-in. A run
 * first brings the backup back, once per account and install, then uploads.
 * Nothing here blocks the screen, and no screen or store writes through it:
 * the database's triggers say what changed.
 */
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { isAuthApiError } from '@/auth/auth-api';
import { authFetch } from '@/auth/session';
import { STEPS_API_URL } from '@/constants/app';
import { loadProfile, mergePatches, mergeProfile, type ProfilePatch, saveProfile } from '@/data/profile';
import type { Profile, Repository, SqlStore } from '@/data/types';
import { dayKey } from '@/lib/dates';

import {
  type BackupRecord,
  BackupCleared,
  MAX_BATCH_BYTES,
  PROFILE_EDITS_KEY,
  queueSize,
  restoreBackup,
  uploadQueue,
} from './backup-core';
import { type BackupStatus, IDLE_STATUS } from './backup-line';

export type { BackupPhase, BackupStatus } from './backup-line';

/** kv: the account whose backup came back to this phone (clearAll wipes it, so a reset restores again). */
export const RESTORED_KEY = 'backupRestoredFor';
/** kv: when the last upload run finished. */
export const LAST_KEY = 'backupLastAt';

/** Changes upload once nothing has changed for this long… */
const QUIET_MS = 25_000;
/** …or once the oldest has waited this long (steps change every minute on a walk). */
const MAX_WAIT_MS = 3 * 60_000;
const CHECK_MS = 10_000;
const BACKOFF_FIRST_MS = 30_000;
const BACKOFF_MAX_MS = 30 * 60_000;
/** Sign-out waits at most this long for the upload. */
export const SIGN_OUT_FLUSH_MS = 4_000;
/**
 * A backup call may take this long before it counts as no connection
 * (authFetch's own 20 s is too short for a batch on a slow link).
 */
export const POST_TIMEOUT_MS = 120_000;
export const GET_TIMEOUT_MS = 90_000;
/** Batches start this size, halve after a call that timed out (down to the least) and double after one that went. */
export const FIRST_BATCH_BYTES = 200_000;
export const LEAST_BATCH_BYTES = 50_000;

type Kick = 'start' | 'foreground' | 'check' | 'flush';

class BackupHttpError extends Error {
  constructor(readonly kind: 'offline' | 'auth' | 'server') {
    super(`Backup call failed: ${kind}`);
  }
}

let repo: Repository | null = null;
let account: string | null = null;
/** Bumped on every account change, so a run for the one before doesn't report. */
let generation = 0;
let status: BackupStatus = IDLE_STATUS;
const listeners = new Set<() => void>();
const restoredListeners = new Set<() => void>();
let running: Promise<void> | null = null;
let again = false;
let failures = 0;
let retryAt = 0;
let lastTry = 0;
let stopped = false;
/** The backup came back for this account (RESTORED_KEY), as of clears() = restoredAt. */
let restored = false;
let restoredAt = 0;
/**
 * A restore may start: from the start or sign-in on. A reset while the app
 * is open (Delete all app data) waits for the next start, so the data the
 * person just deleted doesn't come straight back under their eyes.
 */
let mayRestore = false;
let timer: ReturnType<typeof setInterval> | null = null;
let appState: { remove(): void } | null = null;
let batchBytes = FIRST_BATCH_BYTES;
/** Restore pages and profile changes, one at a time (holdRestore). */
let restoreGate: Promise<unknown> = Promise.resolve();

/** Runs `task` when no restore page is being written, and holds the next one back until it's done. */
function holdRestore<T>(task: () => Promise<T>): Promise<T> {
  const run = restoreGate.then(task, task);
  restoreGate = run.catch(() => undefined);
  return run;
}

function report(patch: Partial<BackupStatus>) {
  const next = { ...status, ...patch };
  if (next.phase === status.phase && next.lastAt === status.lastAt && next.pending === status.pending) return;
  status = next;
  for (const l of listeners) l();
}

const toHttpError = (e: unknown) =>
  e instanceof BackupHttpError
    ? e
    : new BackupHttpError(
        isAuthApiError(e) ? (e.code === 'offline' ? 'offline' : e.code === 'signed_out' ? 'auth' : 'server') : 'offline',
      );

async function call(path: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    res = await authFetch(`${STEPS_API_URL}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    throw toHttpError(e);
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 401 || res.status === 403) throw new BackupHttpError('auth');
  if (!res.ok) throw new BackupHttpError('server');
  try {
    return await res.json();
  } catch {
    throw new BackupHttpError('server');
  }
}

async function post(records: BackupRecord[]) {
  let body: { rejected?: unknown } | null;
  try {
    body = (await call(
      '/v1/backup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ records }),
      },
      POST_TIMEOUT_MS,
    )) as { rejected?: unknown } | null;
  } catch (e) {
    // Too slow (or no connection): smaller batches from now on, so a slow link still gets through.
    if (e instanceof BackupHttpError && e.kind === 'offline') batchBytes = Math.max(LEAST_BATCH_BYTES, Math.floor(batchBytes / 2));
    throw e;
  }
  batchBytes = Math.min(MAX_BATCH_BYTES, batchBytes * 2);
  const rejected = Array.isArray(body?.rejected) ? (body.rejected as { t: string; k: string; error: string }[]) : [];
  return { rejected };
}

async function getPage(cursor: string | null) {
  const body = (await call(
    `/v1/backup${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    GET_TIMEOUT_MS,
  )) as { records?: unknown; next?: unknown } | null;
  if (!body || !Array.isArray(body.records)) throw new BackupHttpError('server');
  return { records: body.records as unknown[], next: typeof body.next === 'string' && body.next ? body.next : null };
}

const warn = (message: string) => console.warn(message);

/** The backup came back (or had already): the profile edits kept for it have done their job. */
async function dropProfileEdits(sql: SqlStore) {
  await sql.run('DELETE FROM kv WHERE key = ?', PROFILE_EDITS_KEY);
}

async function runOnce(): Promise<void> {
  const r = repo;
  const sql = r?.sql;
  const user = account;
  if (!r || !sql || !user || stopped) return;
  const gen = generation;
  const current = () => gen === generation;
  // Every call checks the account is still this run's: after a sign-out the token may soon be someone else's.
  const mine = <A extends unknown[], R>(f: (...args: A) => Promise<R>) => (...args: A) =>
    current() ? f(...args) : Promise.reject(new BackupCleared());
  lastTry = Date.now();
  try {
    if (restored && sql.clears() !== restoredAt) {
      // Reset since: the flag went with the rest of kv.
      restored = false;
      mayRestore = false;
    }
    if (!restored) {
      restoredAt = sql.clears();
      restored = (await r.getKv<string>(RESTORED_KEY)) === user;
      if (restored) await dropProfileEdits(sql);
    }
    if (!restored && !mayRestore) {
      report({ phase: 'waiting', lastAt: null, pending: await queueSize(sql) });
      return;
    }
    if (!restored) {
      report({ phase: 'restoring' });
      const before = sql.clears();
      // Its pages are written one at a time with the app's profile changes (saveProfileChange).
      const held: SqlStore = { ...sql, pausedExec: (statements) => holdRestore(() => sql.pausedExec(statements)) };
      await restoreBackup(held, {
        get: mine(getPage),
        today: dayKey(new Date()),
        warn,
        // The profile is back: the app takes it now (onboarding fills in), not only once every walk is.
        pageWritten: (types) => {
          if (current() && types.has('kv')) for (const l of restoredListeners) l();
        },
      });
      if (!current()) return;
      if (sql.clears() !== before) throw new BackupCleared();
      await r.setKv(RESTORED_KEY, user);
      restored = true;
      restoredAt = sql.clears();
      await dropProfileEdits(sql);
      for (const l of restoredListeners) l();
    }
    const pending = await queueSize(sql);
    if (pending > 0) report({ phase: 'uploading', pending });
    await uploadQueue(sql, { post: mine(post), warn, maxBytes: () => batchBytes });
    if (!current()) return;
    const now = Date.now();
    await r.setKv(LAST_KEY, now);
    failures = 0;
    retryAt = 0;
    report({ phase: 'done', lastAt: now, pending: await queueSize(sql) });
  } catch (e) {
    if (!current()) return;
    if (e instanceof BackupCleared) {
      // Reset meanwhile: the restore waits for the next start.
      restored = false;
      mayRestore = false;
      report({ phase: 'waiting', lastAt: null, pending: await queueSize(sql).catch(() => 0) });
      return;
    }
    const kind = e instanceof BackupHttpError ? e.kind : 'server';
    if (kind === 'auth') {
      // The account is gone or going, or the session ended: nothing more until a sign-in.
      stopped = true;
      report({ phase: 'off' });
      return;
    }
    failures++;
    retryAt = Date.now() + Math.min(BACKOFF_FIRST_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
    if (!(e instanceof BackupHttpError)) console.warn('Backup failed', e instanceof Error ? e.name : 'error');
    report({ phase: kind === 'offline' ? 'offline' : 'failed', pending: await queueSize(sql).catch(() => status.pending) });
  }
}

function kick(why: Kick): Promise<void> {
  if (!repo?.sql || !account || stopped) return Promise.resolve();
  const now = Date.now();
  // After a failure: checks wait out the back-off; coming to the front tries at most every half minute.
  if (why === 'check' && now < retryAt) return Promise.resolve();
  if (why === 'foreground' && failures > 0 && now - lastTry < BACKOFF_FIRST_MS) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  const run = (async () => {
    try {
      do {
        again = false;
        await runOnce();
      } while (again && !stopped);
    } finally {
      running = null;
    }
  })();
  running = run;
  return run;
}

/** Every few seconds while open: a run once changes have gone quiet, or a restore that failed is due again. */
async function check() {
  const sql = repo?.sql;
  if (!sql || !account || running || stopped) return;
  if (!restored) {
    // A restore that failed is tried again (after its back-off).
    if (mayRestore) await kick('check');
    return;
  }
  const [q] = await sql
    .all<{ n: number; newest: number | null; oldest: number | null }>(
      'SELECT COUNT(*) AS n, MAX(changed_ms) AS newest, MIN(changed_ms) AS oldest FROM sync_queue',
    )
    .catch(() => [] as { n: number; newest: number | null; oldest: number | null }[]);
  if (!q?.n) return;
  if (status.phase === 'done' && q.n !== status.pending) report({ pending: q.n });
  const now = Date.now();
  if (now - (q.newest ?? now) >= QUIET_MS || now - (q.oldest ?? now) >= MAX_WAIT_MS) await kick('check');
}

function startChecks() {
  if (!timer) timer = setInterval(() => void check().catch(() => undefined), CHECK_MS);
}

function stopChecks() {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Who the data on this phone belongs to now (src/app/_layout.tsx calls it
 * once claimLocalData is done), or null when signed out. Starts the backup
 * for them: restore if it hasn't come back yet, then upload.
 */
export function setBackupAccount(r: Repository | null, userId: string | null): void {
  if (r === repo && userId === account) return;
  repo = r;
  account = userId;
  generation++;
  failures = 0;
  retryAt = 0;
  batchBytes = FIRST_BATCH_BYTES;
  stopped = false;
  restored = false;
  mayRestore = true;
  again = false;
  stopChecks();
  appState?.remove();
  appState = null;
  if (!r?.sql || !userId) {
    report({ ...IDLE_STATUS });
    return;
  }
  const gen = generation;
  report({ phase: 'waiting', lastAt: null, pending: 0 });
  r.getKv<number>(LAST_KEY)
    .then((lastAt) => {
      if (gen === generation && status.lastAt === null && typeof lastAt === 'number') report({ lastAt });
    })
    .catch(() => undefined);
  appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      startChecks();
      void kick('foreground');
    } else if (state === 'background') {
      stopChecks();
    }
  });
  if (AppState.currentState !== 'background') startChecks();
  void kick('start');
}

/** Before sign-out: one more try at what is waiting, for at most `ms`. Never rejects. */
export async function flushBackup(ms = SIGN_OUT_FLUSH_MS): Promise<void> {
  if (!repo?.sql || !account || stopped || !restored) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    kick('flush').catch(() => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, ms);
    }),
  ]);
  clearTimeout(timeout);
}

/**
 * Saves a change to the profile (Settings, the end of onboarding): `patch`
 * over the profile as stored now, then `extra` (onboarded). Never in the
 * middle of a restore page, and while this account's backup is still to
 * come back the patch is also kept (kv PROFILE_EDITS_KEY), so the restore
 * lays it over the backed-up profile instead of one replacing the other.
 */
export function saveProfileChange(r: Repository, patch: ProfilePatch, extra: Partial<Profile> = {}): Promise<Profile> {
  return holdRestore(async () => {
    const next: Profile = { ...mergeProfile(await loadProfile(r), patch), ...extra };
    if (r === repo && r.sql && account && !restored) {
      // A weight typed in counts as the person's own however the backup has it.
      const own: ProfilePatch = patch.weightKg !== undefined ? { ...patch, weightSet: next.weightSet } : patch;
      await r.setKv(PROFILE_EDITS_KEY, mergePatches(await r.getKv<ProfilePatch>(PROFILE_EDITS_KEY), own));
    }
    await saveProfile(r, next);
    return next;
  });
}

/** Called after a restore wrote rows, so the app re-reads them. Returns the unsubscribe. */
export function onBackupRestored(listener: () => void): () => void {
  restoredListeners.add(listener);
  return () => {
    restoredListeners.delete(listener);
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => status;

/** The backup's state for the account card and Today. */
export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
