import { describe, expect, it, jest } from '@jest/globals';

import { AuthApiError, type FetchLike, isAuthApiError, REFRESH_TIMEOUT_MS, type Tokens } from '@/auth/auth-api';
import {
  ACCESS_TTL_CAP_MS,
  createSession,
  FRESH_TOKEN_MIN_MS,
  REFRESH_GRACE_MS,
  REFRESH_MARGIN_MS,
  REFRESH_RETRY_PAUSE_MS,
  REFRESH_RETRY_WINDOW_MS,
  type SessionStore,
  type StoredSession,
} from '@/auth/session-core';

const T0 = 1_800_000_000_000;
const HOUR = 60 * 60_000;

let issued = 0;
/** A fresh token set, as the server would send, valid for an hour from `at`. */
function tokensAt(at: number, userId = 'user-a'): Tokens {
  issued++;
  return {
    userId,
    accessToken: `h.access${issued}.s`,
    accessExpiresAt: at + HOUR,
    refreshToken: `refresh-token-number-${issued}`.padEnd(43, 'x'),
  };
}

function memoryStore(initial: StoredSession | null = null) {
  let saved = initial;
  const store: SessionStore & { saved(): StoredSession | null } = {
    load: async () => saved,
    save: async (s) => {
      saved = s;
    },
    clear: async () => {
      saved = null;
    },
    saved: () => saved,
  };
  return store;
}

/** A refresh endpoint whose answers the test hands out one by one. */
function controlledRefresh() {
  const pending: { token: string; resolve(t: Tokens): void; reject(e: unknown): void }[] = [];
  const refresh = jest.fn(
    (token: string) =>
      new Promise<Tokens>((resolve, reject) => {
        pending.push({ token, resolve, reject });
      }),
  );
  return { refresh, pending };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry pauses that end only when the test says so. */
function controlledPause() {
  const waiting: (() => void)[] = [];
  const pause = jest.fn((_ms: number) => new Promise<void>((resolve) => waiting.push(resolve)));
  const endPause = async () => {
    waiting.shift()?.();
    await flush();
  };
  return { pause, endPause };
}

function setup({
  stored = { userId: 'user-a', refreshToken: 'stored-refresh-token'.padEnd(43, 'x') } as StoredSession | null,
  fetch = (async () => new Response(null, { status: 200 })) as FetchLike,
  timeoutMs = 1_000,
  onTokens = async () => undefined,
} = {}) {
  let clock = T0;
  const store = memoryStore(stored);
  const { refresh, pending } = controlledRefresh();
  const logout = jest.fn(async (_token: string) => undefined);
  const { pause, endPause } = controlledPause();
  const session = createSession({ api: { refresh, logout }, store, fetch, now: () => clock, timeoutMs, pause, onTokens });
  return {
    session,
    store,
    refresh,
    pending,
    logout,
    pause,
    endPause,
    tick: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected a rejection');
}

describe('session: tokens', () => {
  it('starts signed in from the secure store, without asking the server', async () => {
    const { session, refresh } = setup();
    expect(await session.load()).toBe('user-a');
    expect(session.currentUserId()).toBe('user-a');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps the access token until under a minute is left, then refreshes', async () => {
    const { session, store, refresh, pending, tick, now } = setup({ stored: null });
    const first = tokensAt(now());
    await session.start(first);
    expect(store.saved()).toEqual({ userId: 'user-a', refreshToken: first.refreshToken });

    tick(HOUR - REFRESH_MARGIN_MS - 1);
    expect(await session.getAccessToken()).toBe(first.accessToken);
    expect(refresh).not.toHaveBeenCalled();

    tick(1);
    const next = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pending[0].token).toBe(first.refreshToken);
    const second = tokensAt(now());
    pending[0].resolve(second);
    expect(await next).toBe(second.accessToken);
    // The used refresh token is replaced at once: presenting it again would end the session.
    expect(store.saved()).toEqual({ userId: 'user-a', refreshToken: second.refreshToken });
  });

  it('refreshes on first use after a restart', async () => {
    const { session, refresh, pending, now } = setup();
    const next = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledWith('stored-refresh-token'.padEnd(43, 'x'));
    const fresh = tokensAt(now());
    pending[0].resolve(fresh);
    expect(await next).toBe(fresh.accessToken);
  });

  it('runs one refresh at a time and shares its result', async () => {
    const { session, refresh, pending, now } = setup();
    const calls = [session.getAccessToken(), session.getAccessToken(), session.getAccessToken()];
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    const fresh = tokensAt(now());
    pending[0].resolve(fresh);
    expect(await Promise.all(calls)).toEqual([fresh.accessToken, fresh.accessToken, fresh.accessToken]);
    // And the next one after it uses the new token, with no second refresh.
    expect(await session.getAccessToken()).toBe(fresh.accessToken);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't trust the server's expiry past an hour from arrival (phone clock behind)", async () => {
    const { session, refresh, pending, tick, now } = setup({ stored: null });
    const tokens = { ...tokensAt(now()), accessExpiresAt: now() + 5 * HOUR };
    await session.start(tokens);
    tick(ACCESS_TTL_CAP_MS - REFRESH_MARGIN_MS + 1);
    const next = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    pending[0].resolve(tokensAt(now()));
    await next;
  });

  it("counts the token's life by the server's clock when the reply has a Date header (phone clock ahead)", async () => {
    const { session, refresh, pending, tick, now } = setup({ stored: null });
    // The phone thinks it's 61 minutes later than it is: by its clock the token expired already.
    const serverNow = now() - 61 * 60_000;
    await session.start({ ...tokensAt(serverNow), serverTime: serverNow });
    for (let i = 0; i < 5; i++) await session.getAccessToken();
    tick(HOUR - REFRESH_MARGIN_MS - 1);
    await session.getAccessToken();
    expect(refresh).not.toHaveBeenCalled();
    tick(1);
    const next = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    pending[0].resolve(tokensAt(now()));
    await next;
  });

  it('refreshes at most once a minute when it has only the phone clock and that is far ahead', async () => {
    const { session, refresh, pending, tick, now } = setup({ stored: null });
    await session.start(tokensAt(now() - 61 * 60_000));
    for (let i = 0; i < 5; i++) await session.getAccessToken();
    expect(refresh).not.toHaveBeenCalled();
    tick(FRESH_TOKEN_MIN_MS - REFRESH_MARGIN_MS);
    const next = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    pending[0].resolve(tokensAt(now() - 61 * 60_000));
    await next;
    await session.getAccessToken();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a slow refresh but keeps its answer when it comes', async () => {
    const { session, store, refresh, pending, now } = setup({ timeoutMs: 20 });
    // Caught from the start: it rejects while the test sleeps.
    const first = rejection(session.getAccessToken());
    await sleep(40);
    expect(((await first) as AuthApiError).code).toBe('offline');

    // Still in flight: nobody presents the old token again meanwhile.
    const second = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);

    // The server had rotated it: the late answer is the only copy of the new token, so it is kept.
    const late = tokensAt(now());
    pending[0].resolve(late);
    expect(await second).toBe(late.accessToken);
    expect(store.saved()).toEqual({ userId: 'user-a', refreshToken: late.refreshToken });
    expect(await session.getAccessToken()).toBe(late.accessToken);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('tries again with the same token once a slow refresh has really failed', async () => {
    const { session, refresh, pending, endPause, now } = setup({ timeoutMs: 20 });
    const first = rejection(session.getAccessToken());
    await sleep(40);
    await first;
    // auth-api gives up on the request itself (REFRESH_TIMEOUT_MS): its answer, if any, is lost.
    pending[0].reject(new AuthApiError('offline'));
    await flush();
    await endPause();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(pending[1].token).toBe(pending[0].token);
    const fresh = tokensAt(now());
    pending[1].resolve(fresh);
    await flush();
    expect(await session.getAccessToken()).toBe(fresh.accessToken);
  });

  it('signs out when the server refuses the refresh token', async () => {
    const { session, store, pending } = setup();
    const seen: (string | null)[] = [];
    session.subscribe((id) => seen.push(id));
    const next = session.getAccessToken();
    await flush();
    pending[0].reject(new AuthApiError('invalid', 401));
    const error = await rejection(next);
    expect(isAuthApiError(error) && error.code).toBe('invalid');
    expect(session.currentUserId()).toBeNull();
    expect(store.saved()).toBeNull();
    expect(seen).toEqual([null]);
    expect(((await rejection(session.getAccessToken())) as AuthApiError).code).toBe('signed_out');
  });

  it('stays signed in when offline, and tries again next time', async () => {
    const { session, store, refresh, pending, tick, now } = setup();
    const first = session.getAccessToken();
    await flush();
    // Past the retry window, so only the next caller tries again.
    tick(REFRESH_RETRY_WINDOW_MS);
    pending[0].reject(new AuthApiError('offline'));
    expect(((await rejection(first)) as AuthApiError).code).toBe('offline');
    expect(session.currentUserId()).toBe('user-a');
    expect(store.saved()).not.toBeNull();

    const second = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(2);
    const fresh = tokensAt(now());
    pending[1].resolve(fresh);
    expect(await second).toBe(fresh.accessToken);
  });

  it('rejects with signed_out when nobody is signed in', async () => {
    const { session, refresh } = setup({ stored: null });
    expect(((await rejection(session.getAccessToken())) as AuthApiError).code).toBe('signed_out');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('says when new tokens were kept: after a sign-in and a refresh, never after a refused one', async () => {
    const onTokens = jest.fn(async () => undefined);
    const { session, pending, tick, now } = setup({ stored: null, onTokens });
    await session.start(tokensAt(now()));
    expect(onTokens).toHaveBeenCalledTimes(1);

    tick(HOUR);
    const next = session.getAccessToken();
    await flush();
    pending[0].resolve(tokensAt(now()));
    await next;
    expect(onTokens).toHaveBeenCalledTimes(2);

    tick(HOUR);
    const refused = session.getAccessToken();
    await flush();
    pending[1].reject(new AuthApiError('invalid', 401));
    await rejection(refused);
    expect(onTokens).toHaveBeenCalledTimes(2);
  });

  it('keeps the tokens when that hook fails', async () => {
    const { session, store, now } = setup({ stored: null, onTokens: async () => Promise.reject(new Error('keystore')) });
    const tokens = tokensAt(now());
    await session.start(tokens);
    expect(session.currentUserId()).toBe('user-a');
    expect(store.saved()?.refreshToken).toBe(tokens.refreshToken);
  });
});

/**
 * A fake steps-auth refresh with the server's rules: swap on use; the old
 * token once more within the grace window if its successor was never used
 * (the successor then stops working); any other reuse ends the chain.
 */
function graceServer(now: () => number, first: string) {
  type Entry = { usedAt?: number; next?: string; replaced?: boolean };
  const tokens = new Map<string, Entry>([[first, {}]]);
  let revoked = false;
  let n = 0;
  const issue = (): Tokens => {
    const token = `server-token-${++n}`.padEnd(43, 'x');
    tokens.set(token, {});
    return { userId: 'user-a', accessToken: `h.server${n}.s`, accessExpiresAt: now() + HOUR, refreshToken: token };
  };
  const refresh = (presented: string): Tokens => {
    const entry = tokens.get(presented);
    if (!entry || revoked) throw new AuthApiError('invalid', 401);
    if (!entry.usedAt && !entry.replaced) {
      const issued = issue();
      Object.assign(entry, { usedAt: now(), next: issued.refreshToken });
      return issued;
    }
    const next = entry.next ? tokens.get(entry.next) : undefined;
    const inGrace = entry.usedAt !== undefined && entry.usedAt > now() - REFRESH_GRACE_MS;
    if (!entry.replaced && inGrace && next && !next.usedAt && !next.replaced) {
      next.replaced = true;
      const issued = issue();
      entry.next = issued.refreshToken;
      return issued;
    }
    revoked = true;
    throw new AuthApiError('invalid', 401);
  };
  return { refresh, revoked: () => revoked };
}

describe('session: lost refresh replies', () => {
  it('tries a refresh that got no answer again by itself, after a pause, with the same token', async () => {
    const { session, store, refresh, pending, pause, endPause, now } = setup();
    const first = session.getAccessToken();
    await flush();
    pending[0].reject(new AuthApiError('offline'));
    // The caller hears at once, as before; the retry needs no caller.
    expect(((await rejection(first)) as AuthApiError).code).toBe('offline');
    expect(pause).toHaveBeenCalledWith(REFRESH_RETRY_PAUSE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    await endPause();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(pending[1].token).toBe(pending[0].token);
    const fresh = tokensAt(now());
    pending[1].resolve(fresh);
    await flush();
    expect(store.saved()).toEqual({ userId: 'user-a', refreshToken: fresh.refreshToken });
    expect(await session.getAccessToken()).toBe(fresh.accessToken);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('makes a caller during the pause wait for the retry, not send the token again', async () => {
    const { session, refresh, pending, endPause, now } = setup();
    void rejection(session.getAccessToken());
    await flush();
    pending[0].reject(new AuthApiError('offline'));
    await flush();
    const second = session.getAccessToken();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    await endPause();
    expect(refresh).toHaveBeenCalledTimes(2);
    const fresh = tokensAt(now());
    pending[1].resolve(fresh);
    expect(await second).toBe(fresh.accessToken);
  });

  it('retries a server error too, but not a throttle or a refusal', async () => {
    const cases: [AuthApiError, boolean][] = [
      [new AuthApiError('server', 502), true],
      [new AuthApiError('busy', 429), false],
      [new AuthApiError('invalid', 401), false],
    ];
    for (const [error, retried] of cases) {
      const { session, pending, pause } = setup();
      void rejection(session.getAccessToken());
      await flush();
      pending[0].reject(error);
      await flush();
      expect([error.code, pause.mock.calls.length]).toEqual([error.code, retried ? 1 : 0]);
    }
  });

  it('keeps retrying inside the window, and leaves it to the next caller after', async () => {
    const { session, refresh, pending, pause, endPause, tick } = setup();
    void rejection(session.getAccessToken());
    await flush();
    // The last retry that may start: one pause from now is the window's edge.
    tick(REFRESH_RETRY_WINDOW_MS - REFRESH_RETRY_PAUSE_MS);
    pending[0].reject(new AuthApiError('offline'));
    await flush();
    await endPause();
    expect(refresh).toHaveBeenCalledTimes(2);
    tick(1);
    pending[1].reject(new AuthApiError('offline'));
    await flush();
    expect(pause).toHaveBeenCalledTimes(1);
    // Still signed in, and the next caller presents the same token.
    expect(session.currentUserId()).toBe('user-a');
    void rejection(session.getAccessToken());
    await flush();
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(pending[2].token).toBe(pending[0].token);
  });

  it('drops the retry when the person signs out during the pause', async () => {
    const { session, refresh, pending, endPause, logout } = setup();
    void rejection(session.getAccessToken());
    await flush();
    pending[0].reject(new AuthApiError('offline'));
    await flush();
    await session.signOut();
    await endPause();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledWith(pending[0].token);
  });

  it('gets the new token through the grace window when the server swapped it but the reply was lost', async () => {
    let clock = T0;
    const stored = { userId: 'user-a', refreshToken: 'stored-refresh-token'.padEnd(43, 'x') };
    const server = graceServer(() => clock, stored.refreshToken);
    let lose = true;
    const refresh = jest.fn(async (token: string) => {
      const reply = server.refresh(token);
      if (lose) {
        // Swapped, but the reply never comes (a dropped mobile connection) and the request times out.
        lose = false;
        clock += REFRESH_TIMEOUT_MS;
        throw new AuthApiError('offline');
      }
      return reply;
    });
    const { pause, endPause } = controlledPause();
    const store = memoryStore(stored);
    const session = createSession({
      api: { refresh, logout: async () => undefined },
      store,
      fetch: async () => new Response(null),
      now: () => clock,
      pause,
    });
    expect(((await rejection(session.getAccessToken())) as AuthApiError).code).toBe('offline');
    clock += REFRESH_RETRY_PAUSE_MS;
    await endPause();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh.mock.calls[1][0]).toBe(stored.refreshToken);
    expect(server.revoked()).toBe(false);
    // And the chain goes on from the token the retry brought.
    clock += HOUR;
    await session.getAccessToken();
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(server.revoked()).toBe(false);
    expect(store.saved()?.refreshToken).toBe('server-token-3'.padEnd(43, 'x'));
  });

  it('fits a timed-out try and the pause inside the window, and the window inside the grace', () => {
    // A hung request is given up at REFRESH_TIMEOUT_MS; the retry after it must still start in time.
    expect(REFRESH_TIMEOUT_MS + REFRESH_RETRY_PAUSE_MS).toBeLessThanOrEqual(REFRESH_RETRY_WINDOW_MS);
    expect(REFRESH_RETRY_WINDOW_MS).toBeLessThan(REFRESH_GRACE_MS);
    // Longer than the sign-in Lambda can run (10 s), so two tries never overlap on the server.
    expect(REFRESH_RETRY_PAUSE_MS).toBeGreaterThan(10_000);
  });
});

describe('session: signing out', () => {
  it('clears the phone first, then tells the server', async () => {
    const { session, store, logout, now } = setup({ stored: null });
    const tokens = tokensAt(now());
    await session.start(tokens);
    const seen: (string | null)[] = [];
    session.subscribe((id) => seen.push(id));

    await session.signOut();
    expect(session.currentUserId()).toBeNull();
    expect(store.saved()).toBeNull();
    expect(seen).toEqual([null]);
    expect(logout).toHaveBeenCalledWith(tokens.refreshToken);
    expect(((await rejection(session.getAccessToken())) as AuthApiError).code).toBe('signed_out');
  });

  it('still signs out when the server can’t be reached', async () => {
    const { session, store, logout } = setup();
    logout.mockRejectedValueOnce(new AuthApiError('offline'));
    await session.signOut();
    expect(session.currentUserId()).toBeNull();
    expect(store.saved()).toBeNull();
  });

  it("doesn't let a refresh that was in flight sign the person back in", async () => {
    const { session, store, pending, logout, now } = setup();
    const next = session.getAccessToken();
    await flush();
    await session.signOut();
    const late = tokensAt(now());
    pending[0].resolve(late);
    expect(((await rejection(next)) as AuthApiError).code).toBe('signed_out');
    expect(session.currentUserId()).toBeNull();
    expect(store.saved()).toBeNull();
    // The tokens that arrived late are ended on the server too.
    expect(logout).toHaveBeenCalledWith(late.refreshToken);
  });

  it('clearLocal forgets the session without calling the server', async () => {
    const { session, store, logout } = setup();
    await session.load();
    await session.clearLocal();
    expect(session.currentUserId()).toBeNull();
    expect(store.saved()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });
});

describe('session: authFetch', () => {
  it('sends the access token, and on a refusal refreshes once and tries again', async () => {
    // 403 is what the HTTP API's Lambda authorizer answers for a token it refuses.
    const statuses = [403, 200];
    const seenAuth: string[] = [];
    const fetch: FetchLike = async (_url, init) => {
      seenAuth.push((init.headers as Record<string, string>).Authorization);
      return new Response(null, { status: statuses.shift() ?? 500 });
    };
    const { session, refresh, pending, now } = setup({ stored: null, fetch });
    const first = tokensAt(now());
    await session.start(first);

    const res = session.authFetch('https://api.example.in/v1/me', { method: 'DELETE' });
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    const second = tokensAt(now());
    pending[0].resolve(second);
    expect((await res).status).toBe(200);
    expect(seenAuth).toEqual([`Bearer ${first.accessToken}`, `Bearer ${second.accessToken}`]);
  });

  it('tries again only once', async () => {
    let sent = 0;
    const fetch: FetchLike = async () => {
      sent++;
      return new Response(null, { status: 401 });
    };
    const { session, pending, now } = setup({ stored: null, fetch });
    await session.start(tokensAt(now()));
    const res = session.authFetch('https://api.example.in/v1/me');
    await flush();
    pending[0].resolve(tokensAt(now()));
    expect((await res).status).toBe(401);
    expect(sent).toBe(2);
  });

  it('turns a network failure into offline', async () => {
    const fetch: FetchLike = async () => {
      throw new TypeError('Network request failed');
    };
    const { session, now } = setup({ stored: null, fetch });
    await session.start(tokensAt(now()));
    expect(((await rejection(session.authFetch('https://api.example.in/v1/me'))) as AuthApiError).code).toBe(
      'offline',
    );
  });
});
