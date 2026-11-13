/**
 * Steps Premium on the phone. Today's steps are free for everyone; the rest
 * of the app needs premium. What this account has comes from GET /v1/me
 * ("premium", "premiumReason") and is kept in kv, so the app still knows
 * offline. A new install is free until the server has answered.
 *
 * No React Native here, so jest can run it; use-premium.tsx and
 * components/premium-gate.tsx put it on screen. Purchases, later, only change
 * what /v1/me says, so they need nothing new here.
 */
import type { FetchLike } from '@/auth/auth-api';
import type { Repository } from '@/data/types';

/** Why premium is on: free while we test, the allow list, or bought. */
export type PremiumReason = 'testing' | 'list' | 'purchase';
const REASONS: readonly unknown[] = ['testing', 'list', 'purchase'] satisfies PremiumReason[];

export interface PremiumState {
  premium: boolean;
  /** Null when premium is off, or the server gave a reason this app doesn't know. */
  reason: PremiumReason | null;
  /** When the server said so; null until it has answered on this phone. */
  checkedAt: number | null;
  /** The account it was said for: another account signed in on this phone starts free. */
  account: string | null;
}

export const FREE: PremiumState = { premium: false, reason: null, checkedAt: null, account: null };

/** kv keys: what the server last said, and the tester's "Preview as a free user" switch. */
export const PREMIUM_KEY = 'premium';
export const PREVIEW_FREE_KEY = 'premiumPreviewFree';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The premium fields of a GET /v1/me answer, or null when it has none the app
 * can use (a server from before premium, a broken answer): the phone then
 * keeps what it knew rather than locking or opening anything on a guess.
 */
export function readPremium(body: unknown, account: string, now: number): PremiumState | null {
  if (!isObject(body) || typeof body.premium !== 'boolean') return null;
  // A reason only explains premium being on.
  const reason = body.premium && REASONS.includes(body.premiumReason) ? (body.premiumReason as PremiumReason) : null;
  return { premium: body.premium, reason, checkedAt: now, account };
}

/** The value kept in kv, checked like an answer: anything odd counts as free. */
export function readSaved(v: unknown): PremiumState {
  if (!isObject(v) || typeof v.premium !== 'boolean' || typeof v.account !== 'string') return FREE;
  const checkedAt = typeof v.checkedAt === 'number' && Number.isFinite(v.checkedAt) ? v.checkedAt : null;
  const reason = v.premium && REASONS.includes(v.reason) ? (v.reason as PremiumReason) : null;
  return { premium: v.premium, reason, checkedAt, account: v.account };
}

/** Premium screens are open: the account has premium, and a tester isn't previewing the free app. */
export function premiumOpen(state: PremiumState, previewFree: boolean): boolean {
  return state.premium && !(previewFree && state.reason === 'testing');
}

/** Only while premium is free for testing can a tester switch to the free app and back. */
export const canPreviewFree = (state: PremiumState): boolean => state.premium && state.reason === 'testing';

// ── what's free and what isn't ───────────────────────────────────────────

/** Free for everyone: today's step count and goal ring, and setting the goal it counts to. */
export const FREE_FEATURES = ['today-steps', 'daily-goal'] as const;

/** What Steps Premium adds, as the Premium screen lists it. */
export const PREMIUM_FEATURES = [
  { key: 'history', label: 'Your step history, streaks and badges' },
  { key: 'today-details', label: 'Distance, calories, active minutes and steps by the hour' },
  { key: 'walks', label: 'Walks and rides, with your route on a map' },
  { key: 'food', label: 'Food and nutrition' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'heart', label: 'Heart rate and blood pressure' },
  { key: 'body', label: 'Weight and water' },
  { key: 'mood', label: 'Mood, with an evening check-in' },
  { key: 'insights', label: 'Insights: what helps you walk more' },
] as const;

export type Feature = (typeof FREE_FEATURES)[number] | (typeof PREMIUM_FEATURES)[number]['key'];

export function isLocked(feature: Feature, open: boolean): boolean {
  return !open && !(FREE_FEATURES as readonly Feature[]).includes(feature);
}

/**
 * What each locked screen, or part of the Journal, needs. Today, Goals and
 * Step check stay free, with their premium parts locked inside them.
 */
export const SCREEN_FEATURES = {
  walks: 'walks',
  'walk/record': 'walks',
  'walk/[id]': 'walks',
  'walk/places': 'walks',
  insights: 'insights',
  'journal/mood': 'mood',
  'journal/food': 'food',
  'journal/sleep': 'sleep',
  'journal/bp': 'heart',
  'journal/heart': 'heart',
  'journal/weight': 'body',
  'journal/water': 'body',
} as const satisfies Record<string, Feature>;

// ── asking the server ────────────────────────────────────────────────────

/**
 * GET /v1/me for `account`: its premium state, or null when there's no usable
 * answer (offline, signed out, a server error, no premium fields), so the
 * caller keeps what it had. `authFetch` adds the access token.
 */
export async function fetchPremium(
  authFetch: FetchLike,
  stepsApiUrl: string,
  account: string,
  now: () => number = Date.now,
): Promise<PremiumState | null> {
  try {
    const res = await authFetch(`${stepsApiUrl}/v1/me`, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return readPremium(await res.json(), account, now());
  } catch {
    return null;
  }
}

/** A check this soon after the last answer is skipped, unless forced: the app comes to the front often. */
export const RECHECK_MS = 60_000;

export interface PremiumSnapshot {
  /** What the server last said for the signed-in account; FREE when nothing is known. */
  state: PremiumState;
  previewFree: boolean;
  /** Premium screens are open. */
  open: boolean;
  /** The "Preview as a free user" switch is offered. */
  canPreviewFree: boolean;
  /** kv has been read; before that not even the last answer is known. */
  loaded: boolean;
  /** A question to /v1/me is on its way. */
  checking: boolean;
}

export interface PremiumStore {
  get(): PremiumSnapshot;
  subscribe(listener: () => void): () => void;
  /** Reads kv once; every other call waits for it. */
  load(): Promise<void>;
  /** Who is signed in (null: nobody). A different account is asked about at once; resolves when that's done. */
  setAccount(account: string | null): Promise<void>;
  /** Asks /v1/me again; skipped within RECHECK_MS of the last answer unless `force`. */
  refresh(force?: boolean): Promise<void>;
  /** A food route answered 402: free from now, then /v1/me is asked for the rest. */
  denied(): Promise<void>;
  setPreviewFree(on: boolean): Promise<void>;
}

export function createPremiumStore({
  storage,
  fetchState,
  now = Date.now,
}: {
  storage: Pick<Repository, 'getKv' | 'setKv'>;
  /** GET /v1/me for this account (fetchPremium); null when there's no usable answer. */
  fetchState: (account: string) => Promise<PremiumState | null>;
  now?: () => number;
}): PremiumStore {
  let saved: PremiumState = FREE;
  let previewFree = false;
  let account: string | null = null;
  let loaded = false;
  let loading: Promise<void> | null = null;
  // Every check and denial gets a number; an answer is used only if nothing started after it.
  let run = 0;
  let inFlight: { account: string; promise: Promise<void> } | null = null;
  let pending = 0;
  const listeners = new Set<() => void>();

  const makeSnapshot = (): PremiumSnapshot => {
    const state = account !== null && saved.account === account ? saved : FREE;
    return {
      state,
      previewFree,
      open: premiumOpen(state, previewFree),
      canPreviewFree: canPreviewFree(state),
      loaded,
      checking: pending > 0,
    };
  };
  // One object per change, as useSyncExternalStore needs.
  let snapshot = makeSnapshot();
  const changed = () => {
    snapshot = makeSnapshot();
    for (const listener of listeners) listener();
  };

  const load = () =>
    (loading ??= (async () => {
      const [state, preview] = await Promise.all([
        storage.getKv<unknown>(PREMIUM_KEY).catch(() => null),
        storage.getKv<unknown>(PREVIEW_FREE_KEY).catch(() => null),
      ]);
      saved = readSaved(state);
      previewFree = preview === true;
      loaded = true;
      changed();
    })());

  const keep = async (next: PremiumState) => {
    saved = next;
    changed();
    // Not kept is only a problem offline after a restart; the next answer tries again.
    await storage.setKv(PREMIUM_KEY, next).catch(() => undefined);
  };

  const check = async (who: string) => {
    const mine = ++run;
    pending++;
    changed();
    let next: PremiumState | null;
    try {
      next = await fetchState(who).catch(() => null);
    } finally {
      pending--;
      changed();
    }
    // Signed out, someone else signed in, or a newer check or a 402 came meanwhile: this answer is old.
    if (!next || mine !== run || who !== account) return;
    await keep(next);
  };

  const refresh = async (force = false) => {
    await load();
    const who = account;
    if (!who) return;
    if (!force && saved.account === who && saved.checkedAt !== null) {
      const age = now() - saved.checkedAt;
      if (age >= 0 && age < RECHECK_MS) return;
    }
    // Start-up and coming to the front can ask at once; they share one request.
    if (!force && inFlight?.account === who) return inFlight.promise;
    const promise = check(who).finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
    inFlight = { account: who, promise };
    return promise;
  };

  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    async setAccount(next) {
      if (next === account) return;
      account = next;
      run++;
      inFlight = null;
      changed();
      if (next) await refresh(true);
    },
    refresh,
    async denied() {
      await load();
      const who = account;
      if (!who) return;
      // The server just refused: that beats anything it said before, and any answer still on its way.
      run++;
      inFlight = null;
      await keep({ ...FREE, checkedAt: now(), account: who });
      await refresh(true);
    },
    async setPreviewFree(on) {
      await load();
      previewFree = on;
      changed();
      await storage.setKv(PREVIEW_FREE_KEY, on).catch(() => undefined);
    },
  };
}

/**
 * Whether premium screens are open, from what's kept on the phone, for the
 * background sync, which can't ask the server. The kv belongs to this
 * phone's account: another account's sign-in wipes it (auth/owner.ts).
 */
export async function premiumOpenOnPhone(storage: Pick<Repository, 'getKv'>): Promise<boolean> {
  const [state, preview] = await Promise.all([
    storage.getKv<unknown>(PREMIUM_KEY).catch(() => null),
    storage.getKv<unknown>(PREVIEW_FREE_KEY).catch(() => null),
  ]);
  return premiumOpen(readSaved(state), preview === true);
}

// ── a food route said 402 ────────────────────────────────────────────────

const required = new Set<() => void>();

/** Called by the food API on 402 premium_required: the server says this account doesn't have premium. */
export function premiumRequired(): void {
  for (const listener of required) listener();
}

export function onPremiumRequired(listener: () => void): () => void {
  required.add(listener);
  return () => {
    required.delete(listener);
  };
}
