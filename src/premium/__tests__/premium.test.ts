import { describe, expect, it, jest } from '@jest/globals';

import type { FetchLike } from '@/auth/auth-api';
import {
  createPremiumStore,
  fetchPremium,
  FREE,
  FREE_FEATURES,
  isLocked,
  onPremiumRequired,
  PREMIUM_FEATURES,
  PREMIUM_KEY,
  premiumOpen,
  premiumOpenOnPhone,
  premiumRequired,
  type PremiumState,
  PREVIEW_FREE_KEY,
  readPremium,
  readSaved,
  RECHECK_MS,
  SCREEN_FEATURES,
} from '@/premium/premium';

const T0 = 1_800_000_000_000;
const ME = 'acct-me';
const API = 'https://api.example.test';

/** kv as the phone keeps it: JSON text by key. */
function memoryKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getKv: async <T>(key: string): Promise<T | null> => (data.has(key) ? (JSON.parse(data.get(key)!) as T) : null),
    setKv: async <T>(key: string, value: T): Promise<void> => {
      data.set(key, JSON.stringify(value));
    },
    read: (key: string): unknown => (data.has(key) ? JSON.parse(data.get(key)!) : null),
  };
}

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** GET /v1/me as the server would answer it, one reply per call (the last repeats); an Error means no answer. */
function server(...replies: (unknown | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const authFetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const reply = replies.length > 1 ? replies.shift() : replies[0];
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    return answer(reply);
  };
  return { authFetch, calls };
}

function storeWith(authFetch: FetchLike, kv = memoryKv(), clock = { now: T0 }) {
  const store = createPremiumStore({
    storage: kv,
    fetchState: (account) => fetchPremium(authFetch, API, account, () => clock.now),
    now: () => clock.now,
  });
  return { store, kv, clock };
}

/** A /v1/me answer held back until the test lets it go. */
function heldBack() {
  let release!: (state: PremiumState | null) => void;
  const fetchState = jest.fn(
    (_account: string) =>
      new Promise<PremiumState | null>((resolve) => {
        release = resolve;
      }),
  );
  return { fetchState, release: (state: PremiumState | null) => release(state) };
}

const saved = (over: Partial<PremiumState> = {}): PremiumState => ({
  premium: true,
  reason: 'list',
  checkedAt: T0 - 86_400_000,
  account: ME,
  ...over,
});

describe('reading GET /v1/me', () => {
  it('reads premium and its reason, beside the rest of the account', () => {
    const body = { email: 'asha@example.in', emailVerified: true, premium: true, premiumReason: 'testing' };
    expect(readPremium(body, ME, T0)).toEqual({ premium: true, reason: 'testing', checkedAt: T0, account: ME });
    expect(readPremium({ premium: true, premiumReason: 'list' }, ME, T0)?.reason).toBe('list');
    expect(readPremium({ premium: true, premiumReason: 'purchase' }, ME, T0)?.reason).toBe('purchase');
    expect(readPremium({ premium: false, premiumReason: null }, ME, T0)).toEqual({
      premium: false,
      reason: null,
      checkedAt: T0,
      account: ME,
    });
  });

  it('keeps a reason only with premium, and only one it knows', () => {
    expect(readPremium({ premium: false, premiumReason: 'testing' }, ME, T0)?.reason).toBeNull();
    expect(readPremium({ premium: true, premiumReason: 'gift' }, ME, T0)).toMatchObject({ premium: true, reason: null });
    expect(readPremium({ premium: true }, ME, T0)).toMatchObject({ premium: true, reason: null });
  });

  it('has nothing to say when the answer has no premium field (a server from before premium)', () => {
    expect(readPremium({ email: 'asha@example.in', emailVerified: true }, ME, T0)).toBeNull();
    expect(readPremium({ premium: 'true' }, ME, T0)).toBeNull();
    expect(readPremium(null, ME, T0)).toBeNull();
    expect(readPremium([true], ME, T0)).toBeNull();
  });

  it('reads what was kept in kv, counting anything odd as free', () => {
    expect(readSaved(saved())).toEqual(saved());
    expect(readSaved(null)).toEqual(FREE);
    expect(readSaved({ premium: true })).toEqual(FREE); // no account
    expect(readSaved({ ...saved(), reason: 'gift' }).reason).toBeNull();
    expect(readSaved({ ...saved(), checkedAt: 'yesterday' }).checkedAt).toBeNull();
  });

  it('asks GET /v1/me through authFetch and gives up quietly on any failure', async () => {
    const ok = server({ premium: true, premiumReason: 'testing' });
    expect(await fetchPremium(ok.authFetch, API, ME, () => T0)).toMatchObject({ premium: true, reason: 'testing' });
    expect(ok.calls).toHaveLength(1);
    expect(ok.calls[0].url).toBe(`${API}/v1/me`);
    expect(ok.calls[0].init.method).toBe('GET');

    expect(await fetchPremium(server(new Error('offline')).authFetch, API, ME)).toBeNull();
    expect(await fetchPremium(server(answer({ error: 'server' }, 500)).authFetch, API, ME)).toBeNull();
    expect(await fetchPremium(server(answer({ premium: true }, 401)).authFetch, API, ME)).toBeNull();
    expect(await fetchPremium(server(new Response('not json', { status: 200 })).authFetch, API, ME)).toBeNull();
  });
});

describe('premium state on the phone', () => {
  it('starts free on a new install, until /v1/me answers', async () => {
    const { fetchState, release } = heldBack();
    const store = createPremiumStore({ storage: memoryKv(), fetchState, now: () => T0 });
    expect(store.get()).toMatchObject({ open: false, loaded: false, state: FREE });

    const done = store.setAccount(ME);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.get()).toMatchObject({ open: false, loaded: true, checking: true });
    expect(fetchState).toHaveBeenCalledWith(ME);

    release({ premium: true, reason: 'testing', checkedAt: T0, account: ME });
    await done;
    expect(store.get()).toMatchObject({ open: true, canPreviewFree: true, checking: false });
  });

  it('is open while premium is free for testing, and kept for next time', async () => {
    const { store, kv } = storeWith(server({ premium: true, premiumReason: 'testing' }).authFetch);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: true, canPreviewFree: true });
    expect(store.get().state).toEqual({ premium: true, reason: 'testing', checkedAt: T0, account: ME });
    expect(kv.read(PREMIUM_KEY)).toEqual({ premium: true, reason: 'testing', checkedAt: T0, account: ME });
  });

  it('is open for the allow list, with no preview switch', async () => {
    const { store } = storeWith(server({ premium: true, premiumReason: 'list' }).authFetch);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: true, canPreviewFree: false });
  });

  it('is locked when the account has no premium', async () => {
    const { store, kv } = storeWith(server({ premium: false, premiumReason: null }).authFetch);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: false, canPreviewFree: false });
    expect(store.get().state.checkedAt).toBe(T0);
    expect(kv.read(PREMIUM_KEY)).toMatchObject({ premium: false, account: ME });
  });

  it('keeps the last known state offline, after a restart too', async () => {
    const kv = memoryKv({ [PREMIUM_KEY]: saved() });
    const { store } = storeWith(server(new Error('offline')).authFetch, kv);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: true, state: saved() });
    expect(kv.read(PREMIUM_KEY)).toEqual(saved());
  });

  it('keeps the last known state when the server fails or has no premium field yet', async () => {
    for (const reply of [answer({ error: 'server' }, 500), { email: 'asha@example.in' }]) {
      const kv = memoryKv({ [PREMIUM_KEY]: saved({ premium: false, reason: null }) });
      const { store } = storeWith(server(reply).authFetch, kv);
      await store.setAccount(ME);
      expect(store.get()).toMatchObject({ open: false, state: saved({ premium: false, reason: null }) });
    }
  });

  it('stays premium when the next check gets no answer', async () => {
    const { store } = storeWith(server({ premium: true, premiumReason: 'list' }, new Error('offline')).authFetch);
    await store.setAccount(ME);
    await store.refresh(true);
    expect(store.get()).toMatchObject({ open: true });
  });

  it('never lends one account’s premium to another', async () => {
    const kv = memoryKv({ [PREMIUM_KEY]: saved({ account: 'acct-before' }) });
    const { store } = storeWith(server(new Error('offline')).authFetch, kv);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: false, state: FREE });
  });

  it('drops an answer that arrives after signing out or a switch of account', async () => {
    const { fetchState, release } = heldBack();
    const kv = memoryKv();
    const store = createPremiumStore({ storage: kv, fetchState, now: () => T0 });
    const done = store.setAccount(ME);
    await store.load();
    await store.setAccount(null);
    release({ premium: true, reason: 'list', checkedAt: T0, account: ME });
    await done;
    expect(store.get()).toMatchObject({ open: false, state: FREE });
    expect(kv.read(PREMIUM_KEY)).toBeNull();
  });

  it('asks again when the app comes to the front, at most once a minute unless asked to', async () => {
    const s = server({ premium: true, premiumReason: 'list' }, { premium: false, premiumReason: null });
    const { store, clock } = storeWith(s.authFetch);
    await store.setAccount(ME);
    expect(s.calls).toHaveLength(1);

    clock.now = T0 + RECHECK_MS - 1;
    await store.refresh();
    expect(s.calls).toHaveLength(1);
    expect(store.get().open).toBe(true);

    clock.now = T0 + RECHECK_MS;
    await store.refresh();
    expect(s.calls).toHaveLength(2);
    expect(store.get().open).toBe(false);

    await store.refresh(true); // "Check again"
    expect(s.calls).toHaveLength(3);
  });

  it('does nothing while nobody is signed in', async () => {
    const s = server({ premium: true, premiumReason: 'list' });
    const { store } = storeWith(s.authFetch);
    await store.refresh(true);
    await store.denied();
    expect(s.calls).toHaveLength(0);
    expect(store.get().open).toBe(false);
  });

  it('tells subscribers, with a new snapshot each time', async () => {
    const { store } = storeWith(server({ premium: true, premiumReason: 'list' }).authFetch);
    const first = store.get();
    const listener = jest.fn();
    const off = store.subscribe(listener);
    await store.setAccount(ME);
    expect(listener).toHaveBeenCalled();
    expect(store.get()).not.toBe(first);
    expect(store.get()).toBe(store.get());
    off();
    listener.mockClear();
    await store.setPreviewFree(true);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('402 premium_required from a food route', () => {
  it('goes free at once, keeps it, and asks /v1/me again', async () => {
    const s = server({ premium: true, premiumReason: 'list' }, { premium: false, premiumReason: null });
    const { store, kv, clock } = storeWith(s.authFetch);
    await store.setAccount(ME);
    expect(store.get().open).toBe(true);

    clock.now = T0 + 5_000; // well within RECHECK_MS: the 402 asks anyway
    await store.denied();
    expect(store.get()).toMatchObject({ open: false });
    expect(kv.read(PREMIUM_KEY)).toMatchObject({ premium: false, account: ME });
    expect(s.calls).toHaveLength(2);
  });

  it('is free from the moment of the 402, before /v1/me has answered', async () => {
    const answers: ((s: PremiumState | null) => void)[] = [];
    const fetchState = jest.fn(() => new Promise<PremiumState | null>((resolve) => answers.push(resolve)));
    const store = createPremiumStore({ storage: memoryKv({ [PREMIUM_KEY]: saved() }), fetchState, now: () => T0 });
    const first = store.setAccount(ME);
    await store.load();
    expect(store.get().open).toBe(true);

    const denied = store.denied();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.get().open).toBe(false);

    // The answer asked for before the 402 arrives late, saying premium: it's older than the 402.
    answers[0]({ premium: true, reason: 'list', checkedAt: T0, account: ME });
    await first;
    expect(store.get().open).toBe(false);

    // The check after the 402 is what counts.
    answers[1]({ premium: false, reason: null, checkedAt: T0, account: ME });
    await denied;
    expect(store.get().open).toBe(false);
    expect(fetchState).toHaveBeenCalledTimes(2);
  });

  it('reaches the app through one signal', () => {
    const listener = jest.fn();
    const off = onPremiumRequired(listener);
    premiumRequired();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    premiumRequired();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the "Preview as a free user" switch', () => {
  it('locks premium screens for a tester, keeps the switch on offer, and is kept', async () => {
    const { store, kv } = storeWith(server({ premium: true, premiumReason: 'testing' }).authFetch);
    await store.setAccount(ME);
    await store.setPreviewFree(true);
    expect(store.get()).toMatchObject({ open: false, canPreviewFree: true, previewFree: true });
    expect(kv.read(PREVIEW_FREE_KEY)).toBe(true);

    await store.setPreviewFree(false);
    expect(store.get()).toMatchObject({ open: true, previewFree: false });
    expect(kv.read(PREVIEW_FREE_KEY)).toBe(false);
  });

  it('comes back on after a restart', async () => {
    const kv = memoryKv({ [PREMIUM_KEY]: saved({ reason: 'testing' }), [PREVIEW_FREE_KEY]: true });
    const { store } = storeWith(server(new Error('offline')).authFetch, kv);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: false, canPreviewFree: true, previewFree: true });
  });

  it('only works while premium is free for testing', async () => {
    const kv = memoryKv({ [PREVIEW_FREE_KEY]: true });
    const { store } = storeWith(server({ premium: true, premiumReason: 'list' }).authFetch, kv);
    await store.setAccount(ME);
    expect(store.get()).toMatchObject({ open: true, canPreviewFree: false });

    expect(premiumOpen(saved({ reason: 'testing' }), true)).toBe(false);
    expect(premiumOpen(saved({ reason: 'testing' }), false)).toBe(true);
    expect(premiumOpen(saved({ reason: 'purchase' }), true)).toBe(true);
    expect(premiumOpen(saved({ premium: false, reason: null }), false)).toBe(false);
  });
});

describe('which screens are locked', () => {
  it('leaves only today’s steps (and the goal they count to) free', () => {
    expect(FREE_FEATURES).toEqual(['today-steps', 'daily-goal']);
    expect(isLocked('today-steps', false)).toBe(false);
    expect(isLocked('daily-goal', false)).toBe(false);
    for (const f of PREMIUM_FEATURES) expect(isLocked(f.key, false)).toBe(true);
  });

  it('locks every premium screen and part of the Journal for a free account, and none with premium', () => {
    const screens = Object.keys(SCREEN_FEATURES).sort();
    expect(screens).toEqual(
      [
        'insights',
        'journal/bp',
        'journal/food',
        'journal/heart',
        'journal/mood',
        'journal/sleep',
        'journal/water',
        'journal/weight',
        'walk/[id]',
        'walk/places',
        'walk/record',
        'walks',
      ].sort(),
    );
    for (const feature of Object.values(SCREEN_FEATURES)) {
      expect(isLocked(feature, false)).toBe(true);
      expect(isLocked(feature, true)).toBe(false);
    }
    expect(SCREEN_FEATURES['journal/food']).toBe('food');
    expect(SCREEN_FEATURES['journal/bp']).toBe('heart');
  });

  it('lists what premium includes for the Premium screen', () => {
    const labels = PREMIUM_FEATURES.map((f) => f.label).join('\n');
    for (const word of ['history', 'Walks', 'Food', 'Sleep', 'blood pressure', 'Mood', 'Insights']) {
      expect(labels).toContain(word);
    }
  });

  it('tells the background sync from what the phone kept', async () => {
    expect(await premiumOpenOnPhone(memoryKv())).toBe(false);
    expect(await premiumOpenOnPhone(memoryKv({ [PREMIUM_KEY]: saved() }))).toBe(true);
    expect(await premiumOpenOnPhone(memoryKv({ [PREMIUM_KEY]: saved({ premium: false, reason: null }) }))).toBe(false);
    expect(
      await premiumOpenOnPhone(memoryKv({ [PREMIUM_KEY]: saved({ reason: 'testing' }), [PREVIEW_FREE_KEY]: true })),
    ).toBe(false);
  });
});
