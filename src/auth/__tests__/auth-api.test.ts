import { describe, expect, it } from '@jest/globals';

import { AuthApiError, createAuthApi, errorFor, type FetchLike, isAuthApiError } from '@/auth/auth-api';

const BASE = 'https://auth.example.in';

const TOKENS = {
  userId: 'user-a',
  accessToken: 'aaa.bbb.ccc',
  accessExpiresAt: 1_900_000_000_000,
  refreshToken: 'r'.repeat(43),
};

function reply(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

/** A fetch that answers from a list and remembers what it was asked. */
function fakeFetch(...answers: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = answers.shift();
    if (!next) throw new Error('no more answers');
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (isAuthApiError(e)) return e.code;
    throw e;
  }
  throw new Error('expected a rejection');
}

describe('errorFor', () => {
  it('maps the documented errors', () => {
    expect(errorFor(401, { error: 'unknown_credential' }).code).toBe('unknown_credential');
    expect(errorFor(401, { error: 'invalid' }).code).toBe('invalid');
    expect(errorFor(400, { error: 'invalid' }).code).toBe('invalid');
    expect(errorFor(400, { error: 'adult_required' }).code).toBe('adult_required');
    expect(errorFor(429, { error: 'rate_limited' }).code).toBe('rate_limited');
    expect(errorFor(503, { error: 'not_configured' }).code).toBe('not_configured');
  });

  it("tells API Gateway's throttle apart from the server's own limit", () => {
    expect(errorFor(429, { message: 'Too Many Requests' }).code).toBe('busy');
    expect(errorFor(429, null).code).toBe('busy');
  });

  it('calls anything else a server problem', () => {
    expect(errorFor(500, null).code).toBe('server');
    expect(errorFor(503, { message: 'Service Unavailable' }).code).toBe('server');
    expect(errorFor(403, { error: 'unknown_credential' }).code).toBe('server');
    // A 401 without a known error is still a refusal.
    expect(errorFor(401, 'oops').code).toBe('invalid');
  });
});

describe('createAuthApi', () => {
  it('posts JSON to the documented paths', async () => {
    const { fetch, calls } = fakeFetch(
      reply(200, { challengeId: 'c1', options: { challenge: 'abc' } }),
      reply(200, TOKENS),
      reply(200, { challengeId: 'c2', options: { challenge: 'def', user: { name: 'Steps' } } }),
      reply(200, TOKENS),
      reply(200, TOKENS),
      reply(204),
    );
    const api = createAuthApi({ baseUrl: `${BASE}/`, fetch });
    expect(await api.loginOptions()).toEqual({ challengeId: 'c1', options: { challenge: 'abc' } });
    expect(await api.loginVerify('c1', { id: 'k' })).toEqual(TOKENS);
    await api.registerOptions(true);
    await api.registerVerify('c2', { id: 'k' });
    await api.refresh(TOKENS.refreshToken);
    await api.logout(TOKENS.refreshToken);

    expect(calls.map((c) => c.url)).toEqual([
      `${BASE}/v1/auth/login/options`,
      `${BASE}/v1/auth/login/verify`,
      `${BASE}/v1/auth/register/options`,
      `${BASE}/v1/auth/register/verify`,
      `${BASE}/v1/auth/refresh`,
      `${BASE}/v1/auth/logout`,
    ]);
    expect(calls.every((c) => c.init.method === 'POST')).toBe(true);
    expect(calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([
      {},
      { challengeId: 'c1', credential: { id: 'k' } },
      { adult: true },
      { challengeId: 'c2', credential: { id: 'k' } },
      { refreshToken: TOKENS.refreshToken },
      { refreshToken: TOKENS.refreshToken },
    ]);
  });

  it('maps failed replies to codes', async () => {
    const { fetch } = fakeFetch(
      reply(401, { error: 'unknown_credential' }),
      reply(400, { error: 'adult_required' }),
      reply(429, { error: 'rate_limited' }),
      reply(503, { error: 'not_configured' }),
      reply(502, { message: 'Bad Gateway' }),
      new TypeError('Network request failed'),
    );
    const api = createAuthApi({ baseUrl: BASE, fetch });
    expect(await codeOf(api.loginVerify('c', {}))).toBe('unknown_credential');
    expect(await codeOf(api.registerOptions(true))).toBe('adult_required');
    expect(await codeOf(api.loginOptions())).toBe('rate_limited');
    expect(await codeOf(api.loginOptions())).toBe('not_configured');
    expect(await codeOf(api.refresh(TOKENS.refreshToken))).toBe('server');
    expect(await codeOf(api.loginOptions())).toBe('offline');
  });

  it('gives up after the timeout and calls it offline', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const api = createAuthApi({ baseUrl: BASE, fetch, timeoutMs: 10 });
    expect(await codeOf(api.loginOptions())).toBe('offline');
  });

  it('runs refresh to its own limit, not the one for sign-in calls', async () => {
    const aborted: string[] = [];
    const fetch: FetchLike = (url, init) =>
      new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          aborted.push(url);
          reject(new Error('aborted'));
        });
        if (url.endsWith('/refresh')) setTimeout(() => resolve(reply(200, TOKENS)), 40);
      });
    const api = createAuthApi({ baseUrl: BASE, fetch, timeoutMs: 10, refreshTimeoutMs: 1000 });
    expect(await codeOf(api.loginOptions())).toBe('offline');
    expect((await api.refresh(TOKENS.refreshToken)).refreshToken).toBe(TOKENS.refreshToken);
    expect(aborted).toEqual([`${BASE}/v1/auth/login/options`]);
  });

  it("adds the server's clock from the Date header, and nothing from the body", async () => {
    const date = 'Thu, 12 Nov 2026 10:00:00 GMT';
    const { fetch } = fakeFetch(
      new Response(JSON.stringify(TOKENS), { status: 200, headers: { Date: date } }),
      reply(200, { ...TOKENS, serverTime: 5 }),
      new Response(JSON.stringify(TOKENS), { status: 200, headers: { Date: 'yesterday-ish' } }),
    );
    const api = createAuthApi({ baseUrl: BASE, fetch });
    expect(await api.refresh(TOKENS.refreshToken)).toEqual({ ...TOKENS, serverTime: Date.parse(date) });
    expect((await api.refresh(TOKENS.refreshToken)).serverTime).toBeUndefined();
    expect((await api.refresh(TOKENS.refreshToken)).serverTime).toBeUndefined();
  });

  it('refuses replies that are not what the contract says', async () => {
    const { fetch } = fakeFetch(
      reply(200, { ...TOKENS, accessToken: 'not a jwt\r\nX-Evil: 1' }),
      reply(200, { ...TOKENS, refreshToken: 42 }),
      reply(200, { ...TOKENS, accessExpiresAt: 'tomorrow' }),
      reply(200, { challengeId: 'c1' }),
      new Response('<html>', { status: 200 }),
    );
    const api = createAuthApi({ baseUrl: BASE, fetch });
    expect(await codeOf(api.refresh(TOKENS.refreshToken))).toBe('server');
    expect(await codeOf(api.refresh(TOKENS.refreshToken))).toBe('server');
    expect(await codeOf(api.refresh(TOKENS.refreshToken))).toBe('server');
    expect(await codeOf(api.loginOptions())).toBe('server');
    expect(await codeOf(api.loginOptions())).toBe('server');
  });

  it("isn't ready without an https address", async () => {
    const { fetch, calls } = fakeFetch();
    expect(await codeOf(createAuthApi({ baseUrl: '', fetch }).loginOptions())).toBe('not_configured');
    expect(await codeOf(createAuthApi({ baseUrl: 'http://auth.example.in', fetch }).loginOptions())).toBe(
      'not_configured',
    );
    expect(calls).toHaveLength(0);
  });

  it('marks its errors so callers can tell them apart', () => {
    expect(isAuthApiError(new AuthApiError('offline'))).toBe(true);
    expect(isAuthApiError(new Error('offline'))).toBe(false);
    expect(isAuthApiError({ name: 'AuthApiError', code: 'offline' })).toBe(false);
  });
});

describe('phone sign-in routes', () => {
  const DEVICE = { ...TOKENS, restoreKey: 'k'.repeat(43) };

  it('posts JSON to the documented paths, the email ones through authFetch', async () => {
    const plain = fakeFetch(reply(200, DEVICE), reply(200, TOKENS), reply(202, {}), reply(200, DEVICE));
    const bearer = fakeFetch(reply(202, {}), reply(200, { email: 'asha@example.in', verified: true }));
    const api = createAuthApi({ baseUrl: BASE, fetch: plain.fetch });
    expect(await api.deviceRegister(true)).toEqual(DEVICE);
    expect(await api.deviceRestore(DEVICE.restoreKey)).toEqual(TOKENS);
    await api.emailStart('asha@example.in', bearer.fetch);
    expect(await api.emailFinish('123456', bearer.fetch)).toEqual({ email: 'asha@example.in', verified: true });
    await api.recoverStart('asha@example.in');
    expect(await api.recoverFinish('asha@example.in', '654321')).toEqual(DEVICE);

    expect(plain.calls.map((c) => c.url)).toEqual([
      `${BASE}/v1/auth/device/register`,
      `${BASE}/v1/auth/device/restore`,
      `${BASE}/v1/auth/recover/start`,
      `${BASE}/v1/auth/recover/finish`,
    ]);
    expect(plain.calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([
      { adult: true },
      { restoreKey: DEVICE.restoreKey },
      { email: 'asha@example.in' },
      { email: 'asha@example.in', code: '654321' },
    ]);
    // Only the routes that need the access token go through the session's authFetch.
    expect(bearer.calls.map((c) => c.url)).toEqual([`${BASE}/v1/auth/email/start`, `${BASE}/v1/auth/email/finish`]);
    expect(bearer.calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([
      { email: 'asha@example.in' },
      { code: '123456' },
    ]);
    expect([...plain.calls, ...bearer.calls].every((c) => c.init.method === 'POST')).toBe(true);
  });

  it('maps the phone sign-in errors', async () => {
    const { fetch } = fakeFetch(
      reply(400, { error: 'adult_required' }),
      reply(401, { error: 'invalid' }),
      reply(400, { error: 'bad_email' }),
      reply(503, { error: 'email_unavailable' }),
      reply(400, { error: 'bad_code' }),
      reply(400, { error: 'bad_code' }),
    );
    const api = createAuthApi({ baseUrl: BASE, fetch });
    expect(await codeOf(api.deviceRegister(true))).toBe('adult_required');
    expect(await codeOf(api.deviceRestore('k'.repeat(43)))).toBe('invalid');
    expect(await codeOf(api.emailStart('x@y.in', fetch))).toBe('bad_email');
    expect(await codeOf(api.emailStart('x@y.in', fetch))).toBe('email_unavailable');
    expect(await codeOf(api.emailFinish('000000', fetch))).toBe('bad_code');
    expect(await codeOf(api.recoverFinish('x@y.in', '000000'))).toBe('bad_code');
  });

  it("keeps the server's own reason, so a bare 401 can be told apart", () => {
    expect(errorFor(401, { error: 'invalid' }).reason).toBe('invalid');
    expect(errorFor(401, null).reason).toBe('');
    expect(errorFor(401, null).code).toBe('invalid');
    expect(errorFor(503, { error: 'email_unavailable' }).code).toBe('email_unavailable');
    expect(errorFor(400, { error: 'bad_email' }).code).toBe('bad_email');
    expect(errorFor(400, { error: 'bad_code' }).code).toBe('bad_code');
    // Only with the status the contract gives them.
    expect(errorFor(500, { error: 'email_unavailable' }).code).toBe('server');
    expect(errorFor(401, { error: 'bad_code' }).code).toBe('invalid');
  });

  it("refuses a sign-up or recovery without a restore key, and an email answer it can't read", async () => {
    const { fetch } = fakeFetch(
      reply(200, TOKENS),
      reply(200, { ...DEVICE, restoreKey: 'short' }),
      reply(200, { ...DEVICE, restoreKey: 'not base64url!'.padEnd(43, '!') }),
      reply(200, { email: 'asha@example.in' }),
      reply(200, { email: 42, verified: true }),
    );
    const api = createAuthApi({ baseUrl: BASE, fetch });
    expect(await codeOf(api.deviceRegister(true))).toBe('server');
    expect(await codeOf(api.recoverFinish('x@y.in', '123456'))).toBe('server');
    expect(await codeOf(api.deviceRegister(true))).toBe('server');
    expect(await codeOf(api.emailFinish('123456', fetch))).toBe('server');
    expect(await codeOf(api.emailFinish('123456', fetch))).toBe('server');
  });

  it("passes on authFetch's own error instead of calling it offline", async () => {
    const api = createAuthApi({ baseUrl: BASE, fetch: fakeFetch().fetch });
    const signedOut: FetchLike = async () => {
      throw new AuthApiError('signed_out');
    };
    expect(await codeOf(api.emailStart('x@y.in', signedOut))).toBe('signed_out');
    const dropped: FetchLike = async () => {
      throw new TypeError('Network request failed');
    };
    expect(await codeOf(api.emailFinish('123456', dropped))).toBe('offline');
  });
});
