import { describe, expect, it, jest } from '@jest/globals';

import { deleteAccount, deletedMessage } from '@/auth/account';
import { type AuthApi, AuthApiError, type Tokens } from '@/auth/auth-api';
import { createSession, type Session, type StoredSession } from '@/auth/session-core';
import { createAccountWithPasskey, MESSAGES, parseCredential, type SignInDeps, signInWithPasskey } from '@/auth/sign-in';

import { PasskeyError } from '../../../modules/passkeys/passkeys';

const TOKENS: Tokens = {
  userId: 'user-a',
  accessToken: 'aaa.bbb.ccc',
  accessExpiresAt: 1_900_000_000_000,
  refreshToken: 'r'.repeat(43),
};

const LOGIN_OPTIONS = { challenge: 'login-challenge', rpId: 'neutcrafts.in', allowCredentials: [] };
const REGISTER_OPTIONS = { challenge: 'register-challenge', rp: { id: 'neutcrafts.in' }, user: { name: 'Steps' } };
const ANSWER = JSON.stringify({ id: 'cred-1', rawId: 'cred-1', type: 'public-key', response: { clientDataJSON: 'x' } });

function fakes(overrides: { get?: () => Promise<string>; create?: () => Promise<string>; api?: Partial<AuthApi> } = {}) {
  const order: string[] = [];
  const api = {
    loginOptions: jest.fn(async () => {
      order.push('loginOptions');
      return { challengeId: 'login-1', options: LOGIN_OPTIONS };
    }),
    loginVerify: jest.fn(async (_id: string, _credential: object) => {
      order.push('loginVerify');
      return TOKENS;
    }),
    registerOptions: jest.fn(async (_adult: true) => {
      order.push('registerOptions');
      return { challengeId: 'register-1', options: REGISTER_OPTIONS };
    }),
    registerVerify: jest.fn(async (_id: string, _credential: object) => {
      order.push('registerVerify');
      return TOKENS;
    }),
    ...overrides.api,
  };
  const passkeys = {
    get: jest.fn(async (_json: string) => {
      order.push('get');
      return overrides.get ? overrides.get() : ANSWER;
    }),
    create: jest.fn(async (_json: string) => {
      order.push('create');
      return overrides.create ? overrides.create() : ANSWER;
    }),
  };
  const start = jest.fn(async (_tokens: Tokens) => undefined);
  const deps: SignInDeps = { api, passkeys, start };
  return { deps, api, passkeys, start, order };
}

describe('signInWithPasskey', () => {
  it('asks for options, then the passkey, then has the server check it', async () => {
    const { deps, api, passkeys, start, order } = fakes();
    expect(await signInWithPasskey(deps)).toEqual({ kind: 'signed-in' });
    expect(order).toEqual(['loginOptions', 'get', 'loginVerify']);
    expect(JSON.parse(passkeys.get.mock.calls[0][0])).toEqual(LOGIN_OPTIONS);
    expect(api.loginVerify).toHaveBeenCalledWith('login-1', JSON.parse(ANSWER));
    expect(start).toHaveBeenCalledWith(TOKENS);
  });

  it('offers to make a passkey when the phone has none', async () => {
    const { deps, start, order } = fakes({
      get: async () => {
        throw new PasskeyError('no-credentials');
      },
    });
    expect(await signInWithPasskey(deps)).toEqual({ kind: 'new-here' });
    expect(order).toEqual(['loginOptions', 'get']);
    expect(start).not.toHaveBeenCalled();
  });

  it('stays quiet when the person cancels', async () => {
    const { deps, start } = fakes({
      get: async () => {
        throw new PasskeyError('cancelled');
      },
    });
    expect(await signInWithPasskey(deps)).toEqual({ kind: 'cancelled' });
    expect(start).not.toHaveBeenCalled();
  });

  it('offers a new passkey when no account has the old one (deleted, or its sign-up never finished)', async () => {
    const { deps, start } = fakes({
      api: {
        loginVerify: async () => {
          throw new AuthApiError('unknown_credential', 401);
        },
      },
    });
    expect(await signInWithPasskey(deps)).toEqual({ kind: 'new-here', message: MESSAGES.unknownCredential });
    expect(start).not.toHaveBeenCalled();
  });

  it('says so when offline, before asking for the fingerprint', async () => {
    const { deps, passkeys } = fakes({
      api: {
        loginOptions: async () => {
          throw new AuthApiError('offline');
        },
      },
    });
    expect(await signInWithPasskey(deps)).toEqual({ kind: 'error', message: MESSAGES.offline });
    expect(passkeys.get).not.toHaveBeenCalled();
  });

  it('explains a phone that cannot hold passkeys', async () => {
    const { deps } = fakes({
      get: async () => {
        throw new PasskeyError('not-supported');
      },
    });
    expect(await signInWithPasskey(deps)).toEqual({ kind: 'error', message: MESSAGES.notSupported });
  });

  it("doesn't send an answer it can't read", async () => {
    const { deps, api } = fakes({ get: async () => '{"id": 1}' });
    expect(await signInWithPasskey(deps)).toEqual({
      kind: 'error',
      message: MESSAGES.unknown,
      detail: 'The passkey answer is missing fields',
    });
    expect(api.loginVerify).not.toHaveBeenCalled();
  });
});

describe('createAccountWithPasskey', () => {
  it('needs the 18+ answer before anything else', async () => {
    const { deps, order } = fakes();
    expect(await createAccountWithPasskey(deps, false)).toEqual({ kind: 'error', message: MESSAGES.adultsOnly });
    expect(order).toEqual([]);
  });

  it('registers with adult: true, makes the passkey and starts the session', async () => {
    const { deps, api, passkeys, start, order } = fakes();
    expect(await createAccountWithPasskey(deps, true)).toEqual({ kind: 'signed-in' });
    expect(order).toEqual(['registerOptions', 'create', 'registerVerify']);
    expect(api.registerOptions).toHaveBeenCalledWith(true);
    expect(JSON.parse(passkeys.create.mock.calls[0][0])).toEqual(REGISTER_OPTIONS);
    expect(api.registerVerify).toHaveBeenCalledWith('register-1', JSON.parse(ANSWER));
    expect(start).toHaveBeenCalledWith(TOKENS);
  });

  it('stays quiet when the person cancels making it', async () => {
    const { deps, start } = fakes({
      create: async () => {
        throw new PasskeyError('cancelled');
      },
    });
    expect(await createAccountWithPasskey(deps, true)).toEqual({ kind: 'cancelled' });
    expect(start).not.toHaveBeenCalled();
  });

  it('passes on what the server says', async () => {
    const offline = fakes({
      api: {
        registerVerify: async () => {
          throw new AuthApiError('offline');
        },
      },
    });
    expect(await createAccountWithPasskey(offline.deps, true)).toEqual({ kind: 'error', message: MESSAGES.offline });
    const limited = fakes({
      api: {
        registerOptions: async () => {
          throw new AuthApiError('rate_limited', 429);
        },
      },
    });
    // The server's own 429 on sign-up is its per-network daily limit: waiting minutes won't help.
    expect(await createAccountWithPasskey(limited.deps, true)).toEqual({
      kind: 'error',
      message: MESSAGES.signUpLimited,
    });
    const busy = fakes({
      api: {
        registerOptions: async () => {
          throw new AuthApiError('busy', 429);
        },
      },
    });
    expect(await createAccountWithPasskey(busy.deps, true)).toEqual({ kind: 'error', message: MESSAGES.busy });
  });
});

describe('sign-in limits', () => {
  it('says to wait a little when signing in is limited', async () => {
    for (const [code, message] of [
      ['rate_limited', MESSAGES.rateLimited],
      ['busy', MESSAGES.busy],
    ] as const) {
      const { deps } = fakes({
        api: {
          loginOptions: async () => {
            throw new AuthApiError(code, 429);
          },
        },
      });
      expect(await signInWithPasskey(deps)).toEqual({ kind: 'error', message });
    }
  });
});

describe('parseCredential', () => {
  it('accepts a WebAuthn answer and refuses anything else', () => {
    expect(parseCredential(ANSWER)).toEqual(JSON.parse(ANSWER));
    expect(() => parseCredential('nope')).toThrow(PasskeyError);
    expect(() => parseCredential('[]')).toThrow(PasskeyError);
    expect(() => parseCredential('{"id":"x","type":"password","response":{}}')).toThrow(PasskeyError);
  });
});

describe('deleteAccount', () => {
  const URL = 'https://api.example.in';
  const ID = '3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44';

  /** The secure-store note of a deletion the server left half done. */
  const pendingStore = (initial: string | null = null) => {
    let value = initial;
    return {
      get: jest.fn(async () => value),
      set: jest.fn(async (id: string) => {
        value = id;
      }),
      clear: jest.fn(async () => {
        value = null;
      }),
      value: () => value,
    };
  };

  const setup = (replies: (Response | Error)[], { signsOut = false, pending = pendingStore() } = {}) => {
    const order: string[] = [];
    let userId: string | null = ID;
    const clearLocal = jest.fn(async () => {
      order.push('clearLocal');
      userId = null;
    });
    const authFetch = jest.fn(async (_url: string, _init?: RequestInit) => {
      // What session-core does when the refresh token is refused on the way.
      if (signsOut) userId = null;
      const res = replies.shift() ?? new Error('no more replies');
      if (res instanceof Error) throw res;
      return res;
    });
    const wipePhone = jest.fn(async () => {
      order.push('wipePhone');
    });
    const session = { authFetch, clearLocal, currentUserId: () => userId };
    const run = () => deleteAccount(session, URL, { pending, wipePhone });
    return { session, pending, wipePhone, order, run };
  };

  const deleted = (accountDeleted: boolean) =>
    new Response(JSON.stringify({ dataDeleted: true, accountDeleted }), { status: 200 });

  it('deletes on the server, then forgets the session and clears the phone', async () => {
    const { session, wipePhone, order, run } = setup([deleted(true)]);
    expect(await run()).toEqual({ ok: true, message: deletedMessage(ID) });
    expect(session.authFetch).toHaveBeenCalledWith(`${URL}/v1/me`, { method: 'DELETE' });
    // Signed out first, so the sign-in screen covers the app while its data goes.
    expect(order).toEqual(['clearLocal', 'wipePhone']);
    expect(wipePhone).toHaveBeenCalledTimes(1);
  });

  it('keeps the session and the phone data when the server did not finish', async () => {
    for (const res of [new Response(null, { status: 500 }), deleted(false), new AuthApiError('offline')]) {
      const { session, wipePhone, run } = setup([res]);
      const result = await run();
      expect(result.ok).toBe(false);
      expect(session.clearLocal).not.toHaveBeenCalled();
      expect(wipePhone).not.toHaveBeenCalled();
    }
  });

  it('remembers a half-done deletion, and forgets it once a retry finishes', async () => {
    const { pending, wipePhone, run } = setup([deleted(false), deleted(true)]);
    expect(await run()).toEqual({ ok: false, message: "Your data is deleted, but your sign-in isn't yet. Try again." });
    expect(pending.value()).toBe(ID);
    expect((await run()).ok).toBe(true);
    expect(pending.value()).toBeNull();
    expect(wipePhone).toHaveBeenCalledTimes(1);
  });

  it('counts a half-done deletion as done when the session ends before the retry', async () => {
    // The server shut the account first, so the retry's refresh is refused and signs out.
    const { pending, wipePhone, run } = setup([deleted(false)]);
    await run();
    const second = setup([new AuthApiError('invalid', 401)], { signsOut: true, pending });
    expect(await second.run()).toEqual({ ok: true, message: deletedMessage(ID) });
    expect(pending.value()).toBeNull();
    expect(second.wipePhone).toHaveBeenCalledTimes(1);
    expect(wipePhone).not.toHaveBeenCalled();
  });

  it('says to sign in again when the session ended on the way, instead of failing silently', async () => {
    for (const pending of [pendingStore(), pendingStore('another-account')]) {
      const { wipePhone, run } = setup([new AuthApiError('invalid', 401)], { signsOut: true, pending });
      // A deletion whose reply was lost ends here too, and then the passkey no longer signs in.
      expect(await run()).toEqual({
        ok: false,
        signedOut: true,
        message:
          "Sign in again to finish deleting your account. If your passkey doesn't work any more, the account is already deleted. Uninstall Steps to clear its data from this phone.",
      });
      expect(wipePhone).not.toHaveBeenCalled();
    }
  });

  it("still counts as deleted when the phone can't be cleared, and says what's left", async () => {
    const { wipePhone, run } = setup([deleted(true)]);
    wipePhone.mockRejectedValueOnce(new Error('disk'));
    expect(await run()).toEqual({ ok: true, message: deletedMessage(ID, false) });
    expect(deletedMessage(ID, false)).toContain('some data is still on this phone');
  });

  it('names the passkey to remove, as Google Password Manager lists it', () => {
    expect(deletedMessage(ID)).toBe(
      'Your account and the data on this phone are deleted. You can also remove the passkey “Steps 3F2A91” in Google Password Manager.',
    );
    expect(deletedMessage(null)).toContain('the Steps passkey');
  });
});

describe('deleteAccount with the real session', () => {
  const URL = 'https://api.example.in';
  const ID = '3f2a91bc-77de-4e1a-9c1b-0d6a3f1e2b44';

  /** One phone, wired as session.ts wires it, against a server that left the deletion half done. */
  function phone() {
    let n = 0;
    const server = { refuseRefresh: false, deletes: 0 };
    const issue = (): Tokens => {
      n++;
      return {
        userId: ID,
        accessToken: `h.access${n}.s`,
        accessExpiresAt: Date.now() + 3_600_000,
        refreshToken: `refresh-${n}`.padEnd(43, 'x'),
      };
    };
    const api = {
      refresh: jest.fn(async (_token: string) => {
        if (server.refuseRefresh) throw new AuthApiError('invalid', 401);
        return issue();
      }),
      logout: jest.fn(async (_token: string) => undefined),
    };
    const fetch = async () => {
      server.deletes++;
      return new Response(JSON.stringify({ dataDeleted: true, accountDeleted: false }), { status: 200 });
    };
    let saved: StoredSession | null = null;
    const store = {
      load: async () => saved,
      save: async (s: StoredSession) => {
        saved = s;
      },
      clear: async () => {
        saved = null;
      },
    };
    let note: string | null = null;
    const pending = {
      get: async () => note,
      set: async (id: string) => {
        note = id;
      },
      clear: async () => {
        note = null;
      },
    };
    // Each call is a new run of the app: the access token lived in memory only.
    const open = () => createSession({ api, store, fetch, onTokens: () => pending.clear() });
    const wipePhone = jest.fn(async () => undefined);
    const tapDelete = (session: Session) => deleteAccount(session, URL, { pending, wipePhone });
    return { server, issue, open, note: () => note, wipePhone, tapDelete };
  }

  it('counts a half-done deletion as done after a restart, with no second DELETE', async () => {
    const p = phone();
    const before = p.open();
    await before.start(p.issue());
    expect((await p.tapDelete(before)).ok).toBe(false);
    expect(p.note()).toBe(ID);

    // The account is shut for good, so the next run's refresh is refused.
    p.server.refuseRefresh = true;
    const after = p.open();
    await after.load();
    expect(await p.tapDelete(after)).toEqual({ ok: true, message: deletedMessage(ID) });
    expect(p.server.deletes).toBe(1);
    expect(p.wipePhone).toHaveBeenCalledTimes(1);
    expect(p.note()).toBeNull();
  });

  it('forgets the note once the account signs in again, so a refused refresh later is no deletion', async () => {
    const p = phone();
    const session = p.open();
    await session.start(p.issue());
    await p.tapDelete(session);
    await session.signOut();
    expect(p.note()).toBe(ID);

    // The server let the account sign in again: it wasn't shut after all.
    await session.start(p.issue());
    expect(p.note()).toBeNull();

    // Much later its refresh is refused for another reason (say the 90 days ran out).
    p.server.refuseRefresh = true;
    const later = p.open();
    await later.load();
    const result = await p.tapDelete(later);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ signedOut: true });
    expect(result.message).toContain('Sign in again to finish deleting your account.');
    expect(p.wipePhone).not.toHaveBeenCalled();
  });

  it('forgets the note after a refresh the server allowed', async () => {
    const p = phone();
    const before = p.open();
    await before.start(p.issue());
    await p.tapDelete(before);
    expect(p.note()).toBe(ID);

    const after = p.open();
    await after.load();
    await after.getAccessToken();
    expect(p.note()).toBeNull();
  });
});
