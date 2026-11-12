import { AUTH_API_URL } from '@/constants/app';

/** What every successful sign-in, sign-up and refresh returns (docs/passkeys.md). */
export interface Tokens {
  userId: string;
  /** JWT for the Steps API, about an hour. Kept in memory only. */
  accessToken: string;
  /** Epoch ms, by the server's clock. */
  accessExpiresAt: number;
  /** Single use: every refresh returns a new one. Kept in the secure store. */
  refreshToken: string;
  /**
   * Epoch ms by the server's clock when it answered (the reply's Date
   * header), if there was one. Not part of the body: added by this client so
   * the session can work out how long the token has left without trusting
   * the phone's clock.
   */
  serverTime?: number;
}

/**
 * What a phone sign-up or an email recovery returns (docs/phone-signin.md):
 * the tokens plus this phone's restore key, which goes to Block Store only.
 */
export interface DeviceTokens extends Tokens {
  /** 32 random bytes, base64url. Signs this phone back in after a reinstall (device/restore). */
  restoreKey: string;
}

/** The account's email after `email/finish`. */
export interface EmailStatus {
  email: string;
  verified: boolean;
}

/** A one-time challenge and the WebAuthn options for the phone's passkey sheet. */
export interface Challenge {
  challengeId: string;
  /** PublicKeyCredentialRequestOptionsJSON or PublicKeyCredentialCreationOptionsJSON. */
  options: Record<string, unknown>;
}

/**
 * - `offline`: no connection, or no answer in time.
 * - `unknown_credential`: no account has this passkey (deleted account, or a sign-up that didn't finish).
 * - `invalid`: the server didn't accept the passkey or the refresh token.
 * - `adult_required`, `not_configured`: as the server says.
 * - `bad_email`: the server didn't accept the email address.
 * - `bad_code`: the email code is wrong, too old, or had too many tries.
 * - `email_unavailable`: the server can't send emails right now.
 * - `rate_limited`: the server's own limit (today: sign-ups per network per day).
 * - `busy`: any other 429, i.e. the gateway's per-second throttle; gone in a minute.
 * - `server`: anything else, including a reply the app can't read.
 * - `signed_out`: there is no session to use (raised by session.ts, not the server).
 */
export type AuthErrorCode =
  | 'offline'
  | 'unknown_credential'
  | 'invalid'
  | 'adult_required'
  | 'bad_email'
  | 'bad_code'
  | 'email_unavailable'
  | 'rate_limited'
  | 'busy'
  | 'not_configured'
  | 'server'
  | 'signed_out';

export class AuthApiError extends Error {
  readonly code: AuthErrorCode;
  /** HTTP status, or 0 when there was no reply. */
  readonly status: number;
  /**
   * The `error` the server's body named, '' when there was none. Tells the
   * server's own refusal apart from a bare 401 from anything in between.
   */
  readonly reason: string;

  constructor(code: AuthErrorCode, status = 0, reason = '') {
    super(code);
    this.name = 'AuthApiError';
    this.code = code;
    this.status = status;
    this.reason = reason;
  }
}

// Checked by name, not instanceof: subclassed Errors don't always survive transpiling.
export function isAuthApiError(e: unknown): e is AuthApiError {
  return e instanceof Error && e.name === 'AuthApiError' && typeof (e as AuthApiError).code === 'string';
}

export interface AuthApi {
  loginOptions(): Promise<Challenge>;
  loginVerify(challengeId: string, credential: object): Promise<Tokens>;
  registerOptions(adult: true): Promise<Challenge>;
  registerVerify(challengeId: string, credential: object): Promise<Tokens>;
  refresh(refreshToken: string): Promise<Tokens>;
  logout(refreshToken: string): Promise<void>;
  /** A new account for this phone (docs/phone-signin.md). */
  deviceRegister(adult: true): Promise<DeviceTokens>;
  /** Signs this phone back in with the restore key from Block Store. */
  deviceRestore(restoreKey: string): Promise<Tokens>;
  /**
   * Sends a code to the email, for the signed-in account. `authFetch` adds
   * the access token (session.authFetch, which refreshes once on a 401).
   */
  emailStart(email: string, authFetch: FetchLike): Promise<void>;
  emailFinish(code: string, authFetch: FetchLike): Promise<EmailStatus>;
  /** Sends a code to the email if a confirmed account has it; the answer is the same either way. */
  recoverStart(email: string): Promise<void>;
  /** Signs in to the account with that email and gives this phone a new restore key. */
  recoverFinish(email: string, code: string): Promise<DeviceTokens>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Phone networks can be slow; past this the person is better off trying again. */
export const AUTH_TIMEOUT_MS = 20_000;

/**
 * How long a refresh request may run. The server always answers well within
 * this (its Lambda stops at 10 s), so a refresh still open by then has lost
 * its reply. Kept short so session-core's retry with the same token still
 * reaches the server inside its 60 s grace window (REFRESH_GRACE_MS), which
 * is what recovers a reply the server sent but the phone never got.
 */
export const REFRESH_TIMEOUT_MS = 20_000;

// Shapes the app will accept from the server. Anything else is a bad reply,
// and nothing unchecked ends up in a header or the secure store.
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const REFRESH = /^[A-Za-z0-9_-]{16,512}$/;
// 32 bytes are 43 characters of base64url; a longer key from a later server still fits Block Store.
const RESTORE_KEY = /^[A-Za-z0-9_-]{43,128}$/;

export const isAccountId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
export const isRefreshToken = (v: unknown): v is string => typeof v === 'string' && REFRESH.test(v);
export const isRestoreKey = (v: unknown): v is string => typeof v === 'string' && RESTORE_KEY.test(v);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseTokens(data: unknown): Tokens | null {
  if (!isObject(data)) return null;
  const { userId, accessToken, accessExpiresAt, refreshToken } = data;
  if (!isAccountId(userId) || !isRefreshToken(refreshToken)) return null;
  if (typeof accessToken !== 'string' || accessToken.length > 8192 || !JWT.test(accessToken)) return null;
  if (typeof accessExpiresAt !== 'number' || !Number.isFinite(accessExpiresAt) || accessExpiresAt <= 0) return null;
  return { userId, accessToken, accessExpiresAt, refreshToken };
}

export function parseDeviceTokens(data: unknown): DeviceTokens | null {
  const tokens = parseTokens(data);
  if (!tokens || !isObject(data) || !isRestoreKey(data.restoreKey)) return null;
  return { ...tokens, restoreKey: data.restoreKey };
}

export function parseEmailStatus(data: unknown): EmailStatus | null {
  if (!isObject(data)) return null;
  const { email, verified } = data;
  if (typeof email !== 'string' || email.length === 0 || email.length > 254 || typeof verified !== 'boolean') {
    return null;
  }
  return { email, verified };
}

export function parseChallenge(data: unknown): Challenge | null {
  if (!isObject(data)) return null;
  const { challengeId, options } = data;
  if (typeof challengeId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(challengeId)) return null;
  if (!isObject(options) || typeof options.challenge !== 'string' || options.challenge.length === 0) return null;
  return { challengeId, options };
}

/** The error a failed reply stands for. */
export function errorFor(status: number, data: unknown): AuthApiError {
  const error = isObject(data) && typeof data.error === 'string' ? data.error.slice(0, 64) : '';
  const as = (code: AuthErrorCode) => new AuthApiError(code, status, error);
  // Our Lambda's own limit says `rate_limited`; API Gateway's throttle sends {"message": …}.
  if (status === 429) return as(error === 'rate_limited' ? 'rate_limited' : 'busy');
  if (status === 503 && error === 'not_configured') return as('not_configured');
  if (status === 503 && error === 'email_unavailable') return as('email_unavailable');
  if (status === 401 && error === 'unknown_credential') return as('unknown_credential');
  if (status === 400 && error === 'adult_required') return as('adult_required');
  if (status === 400 && error === 'bad_email') return as('bad_email');
  if (status === 400 && error === 'bad_code') return as('bad_code');
  if (status === 400 || status === 401) return as('invalid');
  return as('server');
}

/** The reply's Date header as epoch ms, or undefined when it's missing or unreadable. */
function serverTimeOf(res: Response): number | undefined {
  try {
    const t = Date.parse(res.headers.get('date') ?? '');
    return Number.isFinite(t) && t > 0 ? t : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The sign-in API in docs/passkeys.md and docs/phone-signin.md. Never logs a
 * body: they hold tokens, restore keys, codes and email addresses.
 */
export function createAuthApi({
  baseUrl,
  fetch: fetchImpl,
  timeoutMs = AUTH_TIMEOUT_MS,
  refreshTimeoutMs = REFRESH_TIMEOUT_MS,
}: {
  baseUrl: string;
  fetch: FetchLike;
  timeoutMs?: number;
  refreshTimeoutMs?: number;
}): AuthApi {
  const base = baseUrl.replace(/\/+$/, '');

  // `send`: session.authFetch for the routes that need the access token.
  const post = async (
    path: string,
    body: object,
    limitMs = timeoutMs,
    send: FetchLike = fetchImpl,
  ): Promise<{ status: number; data: unknown; serverTime?: number }> => {
    // Tokens only ever travel over HTTPS; until the URL is filled in, sign-in isn't ready.
    if (!/^https:\/\/[^/?#]+/.test(base)) throw new AuthApiError('not_configured');
    const controller = new AbortController();
    // React Native's own HTTP client never times out, so a dead connection would hang forever.
    const timer = setTimeout(() => controller.abort(), limitMs);
    let status: number;
    let text: string;
    let serverTime: number | undefined;
    try {
      const res = await send(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      status = res.status;
      serverTime = serverTimeOf(res);
      text = status === 204 ? '' : await res.text();
    } catch (e) {
      // authFetch's own answer, e.g. `signed_out`, says more than "offline".
      if (isAuthApiError(e)) throw e;
      throw new AuthApiError('offline');
    } finally {
      clearTimeout(timer);
    }
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (status < 200 || status >= 300) throw errorFor(status, data);
    return { status, data, serverTime };
  };

  const challenge = async (path: string, body: object) => {
    const { status, data } = await post(path, body);
    const parsed = parseChallenge(data);
    if (!parsed) throw new AuthApiError('server', status);
    return parsed;
  };

  const tokens = async (path: string, body: object, limitMs?: number): Promise<Tokens> => {
    const { status, data, serverTime } = await post(path, body, limitMs);
    const parsed = parseTokens(data);
    if (!parsed) throw new AuthApiError('server', status);
    return serverTime === undefined ? parsed : { ...parsed, serverTime };
  };

  const deviceTokens = async (path: string, body: object): Promise<DeviceTokens> => {
    const { status, data, serverTime } = await post(path, body);
    const parsed = parseDeviceTokens(data);
    if (!parsed) throw new AuthApiError('server', status);
    return serverTime === undefined ? parsed : { ...parsed, serverTime };
  };

  return {
    loginOptions: () => challenge('/v1/auth/login/options', {}),
    loginVerify: (challengeId, credential) => tokens('/v1/auth/login/verify', { challengeId, credential }),
    registerOptions: (adult) => challenge('/v1/auth/register/options', { adult }),
    registerVerify: (challengeId, credential) => tokens('/v1/auth/register/verify', { challengeId, credential }),
    refresh: (refreshToken) => tokens('/v1/auth/refresh', { refreshToken }, refreshTimeoutMs),
    logout: async (refreshToken) => {
      await post('/v1/auth/logout', { refreshToken });
    },
    deviceRegister: (adult) => deviceTokens('/v1/auth/device/register', { adult }),
    deviceRestore: (restoreKey) => tokens('/v1/auth/device/restore', { restoreKey }),
    emailStart: async (email, authFetch) => {
      await post('/v1/auth/email/start', { email }, timeoutMs, authFetch);
    },
    emailFinish: async (code, authFetch) => {
      const { status, data } = await post('/v1/auth/email/finish', { code }, timeoutMs, authFetch);
      const parsed = parseEmailStatus(data);
      if (!parsed) throw new AuthApiError('server', status);
      return parsed;
    },
    recoverStart: async (email) => {
      await post('/v1/auth/recover/start', { email });
    },
    recoverFinish: (email, code) => deviceTokens('/v1/auth/recover/finish', { email, code }),
  };
}

export const authApi = createAuthApi({ baseUrl: AUTH_API_URL, fetch: (url, init) => fetch(url, init) });
