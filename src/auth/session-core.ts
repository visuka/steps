import {
  type AuthApi,
  AuthApiError,
  type FetchLike,
  isAccountId,
  isAuthApiError,
  isRefreshToken,
  type Tokens,
} from '@/auth/auth-api';

/** What survives a restart: who is signed in and the refresh token. Never the access token. */
export interface StoredSession {
  userId: string;
  refreshToken: string;
}

export interface SessionStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

/** A stored value that doesn't look like ours (half-written, older format) counts as signed out. */
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!data || !isAccountId(data.userId) || !isRefreshToken(data.refreshToken)) return null;
    return { userId: data.userId, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

/** Get a new access token once less than this is left on the old one. */
export const REFRESH_MARGIN_MS = 60_000;

/**
 * Never trust an access token for longer than this after it arrived. The
 * server states expiry by its own clock; a phone set hours behind would
 * otherwise keep using a token the server already refuses.
 */
export const ACCESS_TTL_CAP_MS = 60 * 60_000;

/**
 * A token that just arrived is used for at least a minute before the next
 * refresh, whatever the clocks say. Without this, a phone clock far ahead
 * (and a reply with no Date header) would make every call a refresh, and
 * every refresh is a rotation that can go wrong. A token the server refuses
 * early still gets one refresh and retry in authFetch.
 */
export const FRESH_TOKEN_MIN_MS = REFRESH_MARGIN_MS + 60_000;

/**
 * The server's refresh grace window (stepsinfra tokens.mjs GRACE_SECONDS),
 * counted from its first swap of a token: until then, the old token still
 * brings a new one if the token it was swapped for was never used.
 * That is what recovers a reply lost on the way, so a refresh that got no
 * answer is tried again, with the same token, inside it.
 */
export const REFRESH_GRACE_MS = 60_000;

/**
 * Pause before that retry. By then the server is done with the try before
 * (the sign-in Lambda stops at 10 s), so the two can't cross there: the one
 * handled last would replace the token the phone kept.
 */
export const REFRESH_RETRY_PAUSE_MS = 15_000;

/**
 * Retries start at most this long after the first try, which leaves the
 * rest of the grace window for a slow network to carry them. Later, the
 * next caller presents the same token anyway: it's the only one there is.
 */
export const REFRESH_RETRY_WINDOW_MS = REFRESH_GRACE_MS - 15_000;

/** No answer, or none the app could use: the server may have swapped the token anyway. */
const mayHaveSwapped = (e: unknown) => isAuthApiError(e) && (e.code === 'offline' || e.code === 'server');

/** Rejects with `offline` after `ms`, without stopping `work` itself. */
function waitAtMost<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthApiError('offline')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export interface Session {
  /** Reads the secure store once; resolves the signed-in account id or null. */
  load(): Promise<string | null>;
  currentUserId(): string | null;
  /** Called with the account id (or null) whenever someone signs in or out. */
  subscribe(listener: (userId: string | null) => void): () => void;
  /** Keeps the tokens from a sign-in or sign-up. */
  start(tokens: Tokens): Promise<void>;
  /**
   * A valid access token, refreshed first when under a minute is left. Only
   * one refresh runs at a time: the server treats a refresh token presented
   * twice as stolen and ends the session. Rejects with AuthApiError
   * (`signed_out`, `offline`, …).
   */
  getAccessToken(): Promise<string>;
  /** fetch with `Authorization: Bearer` (plain-object headers); on a 401/403 it refreshes once and tries again. */
  authFetch(url: string, init?: RequestInit): Promise<Response>;
  /** Ends the session here, then tells the server (best effort, so it works offline). */
  signOut(): Promise<void>;
  /** Forgets the session on this phone without telling the server (e.g. the account is deleted). */
  clearLocal(): Promise<void>;
}

export function createSession({
  api,
  store,
  fetch: fetchImpl,
  now = Date.now,
  timeoutMs = 20_000,
  pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  onTokens = async () => undefined,
}: {
  api: Pick<AuthApi, 'refresh' | 'logout'>;
  store: SessionStore;
  fetch: FetchLike;
  now?: () => number;
  /** How long a caller waits for an authFetch request, or for a refresh. */
  timeoutMs?: number;
  /** Waits out a retry pause; tests pass their own. */
  pause?: (ms: number) => Promise<void>;
  /**
   * After the tokens of every sign-in, sign-up and refresh are kept. The
   * server gave them, so the account is open: the app forgets a half-done
   * deletion then (src/auth/account.ts).
   */
  onTokens?: () => Promise<void>;
}): Session {
  let userId: string | null = null;
  let refreshToken: string | null = null;
  let access: { token: string; expiresAt: number } | null = null;
  let refreshing: Promise<string> | null = null;
  let loading: Promise<string | null> | null = null;
  // Bumped by every sign-in and sign-out, so a refresh that started before
  // one can't bring the old session back when it finishes.
  let generation = 0;
  const listeners = new Set<(userId: string | null) => void>();

  const emit = () => {
    for (const listener of listeners) listener(userId);
  };

  const tokensKept = async () => {
    try {
      await onTokens();
    } catch {
      // Best effort: the next sign-in or refresh tries again.
    }
  };

  const accessFrom = (tokens: Tokens) => {
    // Time left by the server's own clock when the reply says what that was
    // (the phone's clock can be hours off), else by the phone's.
    const left = tokens.accessExpiresAt - (tokens.serverTime ?? now());
    return {
      token: tokens.accessToken,
      expiresAt: now() + Math.min(Math.max(left, FRESH_TOKEN_MIN_MS), ACCESS_TTL_CAP_MS),
    };
  };

  const load = () => {
    if (!loading) {
      const gen = generation;
      loading = store
        .load()
        .catch(() => null)
        .then((saved) => {
          // A sign-in or sign-out while reading wins over what was stored.
          if (saved && gen === generation) {
            userId = saved.userId;
            refreshToken = saved.refreshToken;
          }
          return userId;
        });
    }
    return loading;
  };

  const clearLocal = async () => {
    generation++;
    userId = null;
    refreshToken = null;
    access = null;
    refreshing = null;
    try {
      await store.clear();
    } catch {
      // Still signed out for this run of the app.
    }
    emit();
  };

  // The refresh request itself, shared by everyone waiting for it. It runs to
  // the end (auth-api's REFRESH_TIMEOUT_MS) even after they stop waiting: if
  // the server already rotated the token, its late answer is the only copy of
  // the new one. Until it ends, nobody presents the old token again.
  // `firstTry`: when this token was first sent, which the retry window counts from.
  const runRefresh = (firstTry = now()): Promise<string> => {
    const gen = generation;
    const presented = refreshToken as string;
    const run = (async () => {
      let tokens: Tokens;
      try {
        tokens = await api.refresh(presented);
      } catch (e) {
        // `invalid`: expired, revoked or the account is gone. Anything else (offline,
        // 5xx) keeps the session for the next try.
        if (gen === generation && isAuthApiError(e) && e.code === 'invalid') await clearLocal();
        throw e;
      }
      if (gen !== generation) {
        // Signed out (or in again) while this was in flight: end what came back too.
        api.logout(tokens.refreshToken).catch(() => undefined);
        throw new AuthApiError('signed_out');
      }
      if (tokens.userId !== userId) {
        // The server named another account: trust neither.
        api.logout(tokens.refreshToken).catch(() => undefined);
        await clearLocal();
        throw new AuthApiError('signed_out');
      }
      refreshToken = tokens.refreshToken;
      access = accessFrom(tokens);
      try {
        await store.save({ userId: tokens.userId, refreshToken: tokens.refreshToken });
      } catch {
        // The new token still works until the app closes; the next start then signs in again.
      }
      await tokensKept();
      return access.token;
    })();
    refreshing = run;
    run.then(
      () => {
        if (refreshing === run) refreshing = null;
      },
      (e: unknown) => {
        if (refreshing !== run) return;
        refreshing = null;
        // Its callers hear at once; the retry goes on without them.
        const retryAt = now() + REFRESH_RETRY_PAUSE_MS;
        if (gen === generation && mayHaveSwapped(e) && retryAt - firstTry <= REFRESH_RETRY_WINDOW_MS) {
          refreshing = retryLater(gen, firstTry);
        }
      },
    );
    return run;
  };

  // Holds `refreshing` through the pause, so a caller meanwhile waits for the
  // retry instead of sending the old token while the server may still be on it.
  const retryLater = (gen: number, firstTry: number): Promise<string> => {
    const later = pause(REFRESH_RETRY_PAUSE_MS).then(() => {
      // Signed out or in again meanwhile: that cleared `refreshing` too.
      if (gen !== generation) throw new AuthApiError('signed_out');
      return runRefresh(firstTry);
    });
    later.catch(() => undefined);
    return later;
  };

  /** Each caller waits at most `timeoutMs` (then `offline`); the request keeps going. */
  const refresh = (): Promise<string> => waitAtMost(refreshing ?? runRefresh(), timeoutMs);

  const getAccessToken = async () => {
    await load();
    if (!userId || !refreshToken) throw new AuthApiError('signed_out');
    if (access && access.expiresAt - now() > REFRESH_MARGIN_MS) return access.token;
    return refresh();
  };

  const authFetch = async (url: string, init: RequestInit = {}) => {
    const send = async (token: string) => {
      const controller = init.signal ? null : new AbortController();
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        return await fetchImpl(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
          signal: init.signal ?? controller?.signal,
        });
      } catch {
        throw new AuthApiError('offline');
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const token = await getAccessToken();
    const res = await send(token);
    // An HTTP API Lambda authorizer answers a refused token with 403, a missing one with 401.
    if (res.status !== 401 && res.status !== 403) return res;
    // Refused before its time (revoked, or the phone's clock is off): one fresh token, one more try.
    if (access?.token === token) access = null;
    return send(await getAccessToken());
  };

  return {
    load,
    currentUserId: () => userId,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start(tokens) {
      await store.save({ userId: tokens.userId, refreshToken: tokens.refreshToken });
      generation++;
      refreshing = null;
      userId = tokens.userId;
      refreshToken = tokens.refreshToken;
      access = accessFrom(tokens);
      await tokensKept();
      emit();
    },
    getAccessToken,
    authFetch,
    async signOut() {
      await load();
      const presented = refreshToken;
      await clearLocal();
      if (presented) await api.logout(presented).catch(() => undefined);
    },
    clearLocal,
  };
}
