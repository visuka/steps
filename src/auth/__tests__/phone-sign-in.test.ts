import { describe, expect, it, jest } from '@jest/globals';

import { deleteAccount, deletedMessage, fetchAccountInfo, parseAccountInfo } from '@/auth/account';
import { AuthApiError, type DeviceTokens, type FetchLike, type Tokens } from '@/auth/auth-api';
import type { LockSupport, UnlockResult } from '@/auth/device-lock';
import {
  confirmEmailCode,
  createPhoneAccount,
  finishRecovery,
  forgetRestoreKey,
  PHONE_MESSAGES,
  type PhoneDeps,
  phoneMessage,
  type PhoneStep,
  RESTORE_KEY_ENTRY,
  restoreOnStart,
  restoreRunner,
  sendEmailCode,
  startRecovery,
} from '@/auth/phone-sign-in';
import { cleanCode, isEmail, isEmailCode, normalizeEmail, resendWaitSeconds } from '@/auth/rules';
import { createSession, type StoredSession } from '@/auth/session-core';
import { MESSAGES } from '@/auth/sign-in';

import { BlockStoreError, type BlockStoreErrorCode } from '../../../modules/blockstore/blockstore';

const RESTORE_KEY = 'k'.repeat(43);
const NEW_KEY = 'n'.repeat(43);

const TOKENS: Tokens = {
  userId: 'user-a',
  accessToken: 'aaa.bbb.ccc',
  accessExpiresAt: 1_900_000_000_000,
  refreshToken: 'r'.repeat(43),
};
const DEVICE_TOKENS: DeviceTokens = { ...TOKENS, restoreKey: RESTORE_KEY };

/** Fakes for everything the phone sign-in touches, recording the order of calls. */
function fakes({
  api = {},
  stored = null as string | null,
  support = 'ready' as LockSupport,
  unlock = 'ok' as UnlockResult,
  storeFails = false,
  retrieveFails = null as BlockStoreErrorCode | null,
} = {}) {
  const order: string[] = [];
  const entries = new Map<string, string>();
  if (stored !== null) entries.set(RESTORE_KEY_ENTRY, stored);
  const blockStore = {
    store: jest.fn(async (key: string, value: string) => {
      order.push('blockStore.store');
      if (storeFails) throw new BlockStoreError('unavailable');
      entries.set(key, value);
      return true;
    }),
    retrieve: jest.fn(async (key: string) => {
      order.push('blockStore.retrieve');
      if (retrieveFails) throw new BlockStoreError(retrieveFails);
      return entries.get(key) ?? null;
    }),
    delete: jest.fn(async (key: string) => {
      order.push('blockStore.delete');
      return entries.delete(key);
    }),
  };
  const authFetch: FetchLike = jest.fn(async () => new Response(null, { status: 500 }));
  const calls = {
    deviceRegister: jest.fn(async (_adult: true) => {
      order.push('deviceRegister');
      return DEVICE_TOKENS;
    }),
    deviceRestore: jest.fn(async (_key: string) => {
      order.push('deviceRestore');
      return TOKENS;
    }),
    emailStart: jest.fn(async (_email: string, _authFetch: FetchLike) => {
      order.push('emailStart');
    }),
    emailFinish: jest.fn(async (_code: string, _authFetch: FetchLike) => {
      order.push('emailFinish');
      return { email: 'asha@example.in', verified: true };
    }),
    recoverStart: jest.fn(async (_email: string) => {
      order.push('recoverStart');
    }),
    recoverFinish: jest.fn(async (_email: string, _code: string) => {
      order.push('recoverFinish');
      return { ...TOKENS, restoreKey: NEW_KEY };
    }),
    ...api,
  };
  const start = jest.fn(async (_tokens: Tokens) => {
    order.push('start');
  });
  const device = {
    lockSupport: jest.fn(async () => {
      order.push('lockSupport');
      return support;
    }),
    unlockWithDevice: jest.fn(async (_prompt: string) => {
      order.push('unlock');
      return unlock;
    }),
  };
  const deps: PhoneDeps = { api: calls, blockStore, start, authFetch, device };
  return { deps, api: calls, blockStore, start, device, authFetch, entries, order };
}

const fail = (code: ConstructorParameters<typeof AuthApiError>[0], status = 0, reason = '') =>
  jest.fn(async () => {
    throw new AuthApiError(code, status, reason);
  });

describe('start-up restore', () => {
  it('signs back in with the key Block Store kept', async () => {
    const { deps, api, start, order } = fakes({ stored: RESTORE_KEY });
    const onFound = jest.fn();
    expect(await restoreOnStart(deps, onFound)).toEqual({ kind: 'restored' });
    expect(api.deviceRestore).toHaveBeenCalledWith(RESTORE_KEY);
    expect(start).toHaveBeenCalledWith(TOKENS);
    expect(onFound).toHaveBeenCalledTimes(1);
    // The key stays: it isn't rotated, and Block Store's cloud copy may be older.
    expect(order).toEqual(['blockStore.retrieve', 'deviceRestore', 'start']);
  });

  it("deletes the entry when the server refuses the key, and shows the first-open screen", async () => {
    const { deps, entries, start } = fakes({
      stored: RESTORE_KEY,
      api: { deviceRestore: fail('invalid', 401, 'invalid') },
    });
    expect(await restoreOnStart(deps)).toEqual({ kind: 'invalid' });
    expect(entries.has(RESTORE_KEY_ENTRY)).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('finds nothing on a first open, without calling the server', async () => {
    const { deps, api } = fakes();
    const onFound = jest.fn();
    expect(await restoreOnStart(deps, onFound)).toEqual({ kind: 'none' });
    expect(api.deviceRestore).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
  });

  it('counts a phone without Block Store as nothing found', async () => {
    const { deps, api } = fakes({ retrieveFails: 'unavailable' });
    expect(await restoreOnStart(deps)).toEqual({ kind: 'none' });
    expect(api.deviceRestore).not.toHaveBeenCalled();
  });

  it("doesn't call a Block Store that failed empty: the key may be there", async () => {
    const { deps, api, blockStore } = fakes({ stored: RESTORE_KEY, retrieveFails: 'failed' });
    const onFound = jest.fn();
    expect(await restoreOnStart(deps, onFound)).toEqual({
      kind: 'error',
      message: PHONE_MESSAGES.blockStoreFailed,
      found: false,
    });
    expect(api.deviceRestore).not.toHaveBeenCalled();
    expect(blockStore.delete).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
    // A plain error from a fake or an older wrapper counts the same.
    blockStore.retrieve.mockRejectedValueOnce(new Error('boom'));
    expect(await restoreOnStart(deps)).toMatchObject({ kind: 'error', found: false });
  });

  it("drops an entry that isn't a restore key, without sending it anywhere", async () => {
    const { deps, api, entries } = fakes({ stored: 'short' });
    expect(await restoreOnStart(deps)).toEqual({ kind: 'none' });
    expect(api.deviceRestore).not.toHaveBeenCalled();
    expect(entries.has(RESTORE_KEY_ENTRY)).toBe(false);
  });

  it('keeps the key when there was no clear answer, to try again', async () => {
    for (const [error, message] of [
      [new AuthApiError('offline'), MESSAGES.offline],
      [new AuthApiError('server', 500, 'server_error'), MESSAGES.unknown],
      [new AuthApiError('busy', 429), MESSAGES.busy],
      // A bare 401 from something in between (a Wi-Fi login page) is no refusal from our server.
      [new AuthApiError('invalid', 401), MESSAGES.invalid],
    ] as const) {
      const { deps, entries } = fakes({
        stored: RESTORE_KEY,
        api: {
          deviceRestore: jest.fn(async () => {
            throw error;
          }),
        },
      });
      expect(await restoreOnStart(deps)).toEqual({ kind: 'error', message, found: true });
      expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
    }
  });
});

describe('restoreRunner', () => {
  const ID = 'user-a';

  it('runs again when a session ends during the run', async () => {
    const run = jest.fn(async (_onFound?: () => void) => undefined);
    const runner = restoreRunner(run);
    runner.seen(ID); // signed in at start-up
    runner.seen(ID); // a refresh kept it
    expect(run).not.toHaveBeenCalled();
    runner.seen(null); // the refresh token was refused
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('leaves the start-up and an already signed-out app to their own call', async () => {
    const run = jest.fn(async (_onFound?: () => void) => undefined);
    const runner = restoreRunner(run);
    runner.seen(null);
    runner.seen(null);
    expect(run).not.toHaveBeenCalled();
  });

  it('holds off while the account is being deleted', async () => {
    const run = jest.fn(async (_onFound?: () => void) => undefined);
    const runner = restoreRunner(run);
    runner.seen(ID);
    expect(
      await runner.paused(async () => {
        runner.seen(null); // deleteAccount's clearLocal
        return 'deleted';
      }),
    ).toBe('deleted');
    expect(run).not.toHaveBeenCalled();
    // Back to normal afterwards, also when the deletion threw.
    await expect(runner.paused(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    runner.seen(ID);
    runner.seen(null);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs one restore at a time', async () => {
    let finish: () => void = () => undefined;
    const run = jest.fn(
      (_onFound?: () => void) =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const runner = restoreRunner(run);
    const onFound = jest.fn();
    const first = runner.run(onFound);
    runner.seen(ID);
    runner.seen(null);
    const retry = runner.run();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(onFound);
    finish();
    await Promise.all([first, retry]);
    // Done, so the next call runs a new one.
    const next = runner.run();
    expect(run).toHaveBeenCalledTimes(2);
    finish();
    await next;
  });

  it('signs back in with the key when the refresh token is refused during the run', async () => {
    // Wired the way AuthProvider does it, around the real session.
    let saved: StoredSession | null = { userId: 'user-a', refreshToken: 'x'.repeat(43) };
    const session = createSession({
      api: { refresh: fail('invalid', 401, 'invalid'), logout: jest.fn(async () => undefined) },
      store: {
        load: async () => saved,
        save: async (s) => {
          saved = s;
        },
        clear: async () => {
          saved = null;
        },
      },
      fetch: jest.fn(async () => new Response(null, { status: 200 })),
    });
    const { deps, api, entries } = fakes({ stored: RESTORE_KEY });
    deps.start = session.start;
    const runs: Promise<void>[] = [];
    const runner = restoreRunner((onFound) => {
      const run = restoreOnStart(deps, onFound).then(() => undefined);
      runs.push(run);
      return run;
    });
    session.subscribe(() => runner.seen(session.currentUserId()));
    runner.seen(await session.load());

    await expect(session.getAccessToken()).rejects.toMatchObject({ code: 'invalid' });
    // Started by the sign-out itself, before the caller heard of it.
    expect(runs).toHaveLength(1);
    await runs[0];
    expect(api.deviceRestore).toHaveBeenCalledTimes(1);
    expect(api.deviceRestore).toHaveBeenCalledWith(RESTORE_KEY);
    expect(session.currentUserId()).toBe(TOKENS.userId);
    expect(saved).toEqual({ userId: TOKENS.userId, refreshToken: TOKENS.refreshToken });
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
  });

  it("doesn't throw when a restore does", async () => {
    const runner = restoreRunner(async () => {
      throw new Error('boom');
    });
    await expect(runner.run()).resolves.toBeUndefined();
  });
});

describe('first open', () => {
  it('checks the fingerprint, registers, keeps the key and the session, then sends the code', async () => {
    const { deps, api, blockStore, start, device, authFetch, entries, order } = fakes();
    const result = await createPhoneAccount(deps, { adult: true, email: '  Asha@Example.IN ' });
    expect(result).toEqual({
      kind: 'signed-in',
      email: 'asha@example.in',
      sent: { kind: 'sent', email: 'asha@example.in' },
      restoreKeyKept: true,
    });
    expect(order).toEqual([
      'lockSupport',
      'unlock',
      'blockStore.retrieve',
      'deviceRegister',
      'blockStore.store',
      'start',
      'emailStart',
    ]);
    expect(device.unlockWithDevice).toHaveBeenCalledWith("Confirm it's you to make your Steps account");
    expect(api.deviceRegister).toHaveBeenCalledWith(true);
    expect(blockStore.store).toHaveBeenCalledWith(RESTORE_KEY_ENTRY, RESTORE_KEY);
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
    // The session (secure store) gets the tokens only, never the restore key.
    expect(start).toHaveBeenCalledWith(TOKENS);
    expect(start.mock.calls[0][0]).not.toHaveProperty('restoreKey');
    expect(api.emailStart).toHaveBeenCalledWith('asha@example.in', authFetch);
  });

  it('then confirms the email with the code', async () => {
    const { deps, api, authFetch } = fakes();
    await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' });
    expect(await confirmEmailCode(deps, '123456')).toEqual({ kind: 'confirmed', email: 'asha@example.in' });
    expect(api.emailFinish).toHaveBeenCalledWith('123456', authFetch);
  });

  it('opens the account even when no email can be sent, and says to confirm it later', async () => {
    const { deps, start } = fakes({ api: { emailStart: fail('email_unavailable', 503, 'email_unavailable') } });
    const result = await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' });
    expect(result).toEqual({
      kind: 'signed-in',
      email: 'asha@example.in',
      sent: {
        kind: 'unavailable',
        message: "We can't send emails right now. Your account works; confirm your email later in Settings.",
      },
      restoreKeyKept: true,
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('still opens the account when Block Store cannot keep the key', async () => {
    const { deps, start } = fakes({ storeFails: true });
    const result = await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' });
    expect(result).toMatchObject({ kind: 'signed-in', restoreKeyKept: false });
    expect(start).toHaveBeenCalledWith(TOKENS);
  });

  it('needs the 18+ answer and an email before the fingerprint', async () => {
    for (const [input, message] of [
      [{ adult: false, email: 'asha@example.in' }, MESSAGES.adultsOnly],
      [{ adult: true, email: '   ' }, PHONE_MESSAGES.enterEmail],
      [{ adult: true, email: 'asha@example' }, PHONE_MESSAGES.badEmail],
    ] as const) {
      const { deps, order } = fakes();
      expect(await createPhoneAccount(deps, input)).toEqual({ kind: 'error', message });
      expect(order).toEqual([]);
    }
  });

  it('explains and stops when the phone has no screen lock', async () => {
    for (const setup of [{ support: 'no-lock' as const }, { unlock: 'no-lock' as const }]) {
      const { deps, api } = fakes(setup);
      expect(await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' })).toEqual({
        kind: 'error',
        message: PHONE_MESSAGES.noScreenLock,
      });
      expect(api.deviceRegister).not.toHaveBeenCalled();
    }
    expect(PHONE_MESSAGES.noScreenLock).toContain('no screen lock');
  });

  it('stays quiet when the fingerprint prompt is closed, and says so when it fails', async () => {
    const cancelled = fakes({ unlock: 'cancelled' });
    expect(await createPhoneAccount(cancelled.deps, { adult: true, email: 'asha@example.in' })).toEqual({
      kind: 'cancelled',
    });
    const failed = fakes({ unlock: 'failed' });
    expect(await createPhoneAccount(failed.deps, { adult: true, email: 'asha@example.in' })).toEqual({
      kind: 'error',
      message: PHONE_MESSAGES.lockFailed,
    });
    expect(cancelled.api.deviceRegister).not.toHaveBeenCalled();
    expect(failed.api.deviceRegister).not.toHaveBeenCalled();
  });

  it("passes on what the server says about a sign-up, keeping nothing", async () => {
    for (const [error, message] of [
      [new AuthApiError('rate_limited', 429, 'rate_limited'), MESSAGES.signUpLimited],
      [new AuthApiError('adult_required', 400, 'adult_required'), MESSAGES.adultsOnly],
      [new AuthApiError('offline'), MESSAGES.offline],
      [new AuthApiError('not_configured'), MESSAGES.notReady],
    ] as const) {
      const { deps, blockStore, start } = fakes({
        api: {
          deviceRegister: jest.fn(async () => {
            throw error;
          }),
        },
      });
      expect(await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' })).toEqual({
        kind: 'error',
        message,
      });
      expect(blockStore.store).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    }
  });

  it('keeps the restore key when the secure store refuses the session, so the next start can sign in', async () => {
    const { deps, api, entries, start } = fakes();
    start.mockRejectedValueOnce(new Error('keystore'));
    expect(await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' })).toEqual({
      kind: 'error',
      message: MESSAGES.unknown,
    });
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
    // "Try again" signs in to that account rather than making a second one over its key.
    expect(await createPhoneAccount(deps, { adult: true, email: 'asha@example.in' })).toEqual({ kind: 'restored' });
    expect(api.deviceRegister).toHaveBeenCalledTimes(1);
    expect(api.deviceRestore).toHaveBeenCalledWith(RESTORE_KEY);
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
  });
});

describe('first open on a phone that already has an account', () => {
  const OLD_KEY = 'o'.repeat(43);
  const input = { adult: true, email: 'asha@example.in' };

  it('signs in to it instead of writing over its key', async () => {
    // E.g. the session ended during the run (refresh refused) and the restore key still works.
    const { deps, api, blockStore, start, entries, order } = fakes({ stored: OLD_KEY });
    expect(await createPhoneAccount(deps, input)).toEqual({ kind: 'restored' });
    expect(api.deviceRestore).toHaveBeenCalledWith(OLD_KEY);
    expect(start).toHaveBeenCalledWith(TOKENS);
    expect(api.deviceRegister).not.toHaveBeenCalled();
    expect(api.emailStart).not.toHaveBeenCalled();
    expect(blockStore.store).not.toHaveBeenCalled();
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(OLD_KEY);
    // The fingerprint check still comes first.
    expect(order).toEqual(['lockSupport', 'unlock', 'blockStore.retrieve', 'deviceRestore', 'start']);
  });

  it('makes the new account once the server refuses the old key', async () => {
    const { deps, api, entries, order } = fakes({
      stored: OLD_KEY,
      api: { deviceRestore: fail('invalid', 401, 'invalid') },
    });
    expect(await createPhoneAccount(deps, input)).toMatchObject({ kind: 'signed-in', restoreKeyKept: true });
    expect(api.deviceRegister).toHaveBeenCalledTimes(1);
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
    expect(order.indexOf('blockStore.delete')).toBeLessThan(order.indexOf('deviceRegister'));
  });

  it('makes no account while the old key gets no clear answer', async () => {
    for (const error of [
      new AuthApiError('offline'),
      new AuthApiError('server', 500, 'server_error'),
      // Not our server's refusal: the key may still work.
      new AuthApiError('invalid', 401),
    ]) {
      const { deps, api, blockStore, entries } = fakes({
        stored: OLD_KEY,
        api: {
          deviceRestore: jest.fn(async () => {
            throw error;
          }),
        },
      });
      expect(await createPhoneAccount(deps, input)).toMatchObject({ kind: 'error' });
      expect(api.deviceRegister).not.toHaveBeenCalled();
      expect(blockStore.store).not.toHaveBeenCalled();
      expect(entries.get(RESTORE_KEY_ENTRY)).toBe(OLD_KEY);
    }
  });

  it('makes no account when Block Store failed, and says to try again', async () => {
    const { deps, api, blockStore } = fakes({ stored: OLD_KEY, retrieveFails: 'failed' });
    expect(await createPhoneAccount(deps, input)).toEqual({ kind: 'error', message: PHONE_MESSAGES.blockStoreFailed });
    expect(api.deviceRegister).not.toHaveBeenCalled();
    expect(blockStore.store).not.toHaveBeenCalled();
  });

  it("makes the account without Block Store, but doesn't write a key it couldn't read first", async () => {
    const { deps, api, blockStore, start } = fakes({ retrieveFails: 'unavailable' });
    expect(await createPhoneAccount(deps, input)).toMatchObject({ kind: 'signed-in', restoreKeyKept: false });
    expect(api.deviceRegister).toHaveBeenCalledTimes(1);
    expect(blockStore.store).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith(TOKENS);
  });

  it('writes over an entry that is no restore key', async () => {
    const { deps, api, entries } = fakes({ stored: 'short' });
    expect(await createPhoneAccount(deps, input)).toMatchObject({ kind: 'signed-in', restoreKeyKept: true });
    expect(api.deviceRestore).not.toHaveBeenCalled();
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
  });
});

describe('email codes', () => {
  it('says what went wrong sending a code', async () => {
    for (const [error, when, expected] of [
      [new AuthApiError('email_unavailable', 503), 'later', { kind: 'unavailable', message: PHONE_MESSAGES.emailUnavailableLater }],
      [new AuthApiError('bad_email', 400), 'first', { kind: 'error', message: PHONE_MESSAGES.badEmail }],
      [new AuthApiError('rate_limited', 429), 'later', { kind: 'error', message: PHONE_MESSAGES.codesLimited }],
      [new AuthApiError('offline'), 'later', { kind: 'error', message: MESSAGES.offline }],
    ] as const) {
      const { deps } = fakes({
        api: {
          emailStart: jest.fn(async () => {
            throw error;
          }),
        },
      });
      expect(await sendEmailCode(deps, 'asha@example.in', when)).toEqual(expected);
    }
  });

  it('checks the email before sending', async () => {
    const { deps, api } = fakes();
    expect(await sendEmailCode(deps, 'nope', 'later')).toEqual({ kind: 'error', message: PHONE_MESSAGES.badEmail });
    expect(api.emailStart).not.toHaveBeenCalled();
  });

  it('wants all 6 digits, and explains a wrong or old code', async () => {
    const { deps, api } = fakes({ api: { emailFinish: fail('bad_code', 400, 'bad_code') } });
    for (const code of ['', '12345', '1234567', '12 456', 'abcdef']) {
      expect(await confirmEmailCode(deps, code)).toEqual({ kind: 'error', message: PHONE_MESSAGES.enterCode });
    }
    expect(api.emailFinish).not.toHaveBeenCalled();
    expect(await confirmEmailCode(deps, '000000')).toEqual({ kind: 'error', message: PHONE_MESSAGES.badCode });
  });

  it("doesn't call an unconfirmed answer confirmed", async () => {
    const { deps } = fakes({
      api: { emailFinish: jest.fn(async () => ({ email: 'asha@example.in', verified: false })) },
    });
    expect(await confirmEmailCode(deps, '123456')).toEqual({ kind: 'error', message: MESSAGES.unknown });
  });
});

describe('recovery', () => {
  it('sends a code to the email, then signs in and keeps the new restore key', async () => {
    const { deps, api, start, entries, order } = fakes({ stored: RESTORE_KEY });
    expect(await startRecovery(deps, ' Asha@Example.in')).toEqual({ kind: 'sent', email: 'asha@example.in' });
    expect(api.recoverStart).toHaveBeenCalledWith('asha@example.in');
    expect(await finishRecovery(deps, 'asha@example.in', '654321')).toEqual({ kind: 'signed-in', restoreKeyKept: true });
    expect(api.recoverFinish).toHaveBeenCalledWith('asha@example.in', '654321');
    expect(entries.get(RESTORE_KEY_ENTRY)).toBe(NEW_KEY);
    expect(start).toHaveBeenCalledWith(TOKENS);
    expect(order).toEqual(['recoverStart', 'recoverFinish', 'blockStore.store', 'start']);
  });

  it('keeps nothing when the code is wrong', async () => {
    const { deps, blockStore, start } = fakes({ api: { recoverFinish: fail('bad_code', 400, 'bad_code') } });
    expect(await finishRecovery(deps, 'asha@example.in', '111111')).toEqual({
      kind: 'error',
      message: PHONE_MESSAGES.badCode,
    });
    expect(blockStore.store).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('checks the email and code on the phone first', async () => {
    const { deps, api } = fakes();
    expect(await startRecovery(deps, '')).toEqual({ kind: 'error', message: PHONE_MESSAGES.enterEmail });
    expect(await finishRecovery(deps, 'asha@example.in', '12')).toEqual({
      kind: 'error',
      message: PHONE_MESSAGES.enterCode,
    });
    expect(api.recoverStart).not.toHaveBeenCalled();
    expect(api.recoverFinish).not.toHaveBeenCalled();
  });

  it("says when emails can't be sent", async () => {
    const { deps } = fakes({ api: { recoverStart: fail('email_unavailable', 503, 'email_unavailable') } });
    expect(await startRecovery(deps, 'asha@example.in')).toEqual({
      kind: 'error',
      message: PHONE_MESSAGES.emailUnavailableLater,
    });
  });
});

describe('phoneMessage', () => {
  const at = (code: ConstructorParameters<typeof AuthApiError>[0], step: PhoneStep) =>
    phoneMessage(new AuthApiError(code), step);

  it('has plain words for every error the server documents, and for being offline', () => {
    expect(at('offline', 'email')).toBe('No internet connection. Connect and try again.');
    expect(at('adult_required', 'register')).toBe('Steps is for adults 18 and over.');
    expect(at('bad_email', 'email')).toBe("That email address doesn't look right. Check it and try again.");
    expect(at('bad_code', 'code')).toBe('That code is wrong or too old. Check the email, or send a new code.');
    expect(at('email_unavailable', 'email')).toBe(
      "We can't send emails right now. Your account works; confirm your email later in Settings.",
    );
    expect(at('email_unavailable', 'recover')).toBe("We can't send emails right now. Try again later.");
    expect(at('invalid', 'restore')).toBe(MESSAGES.invalid);
    expect(at('not_configured', 'register')).toBe(MESSAGES.notReady);
    expect(at('busy', 'code')).toBe(MESSAGES.busy);
    expect(at('server', 'code')).toBe(MESSAGES.unknown);
    expect(at('signed_out', 'email')).toBe(MESSAGES.unknown);
    expect(phoneMessage(new Error('boom'), 'email')).toBe(MESSAGES.unknown);
  });

  it('tells a sign-up limit from a code limit', () => {
    expect(at('rate_limited', 'register')).toBe(MESSAGES.signUpLimited);
    expect(at('rate_limited', 'email')).toBe(PHONE_MESSAGES.codesLimited);
    expect(at('rate_limited', 'recover')).toBe(PHONE_MESSAGES.codesLimited);
    expect(at('rate_limited', 'code')).toBe(PHONE_MESSAGES.codesLimited);
    expect(at('rate_limited', 'restore')).toBe(MESSAGES.rateLimited);
  });
});

describe('email rules', () => {
  it('reads emails and codes the way people type them', () => {
    expect(normalizeEmail('  Asha@Example.IN ')).toBe('asha@example.in');
    expect(isEmail('asha@example.in')).toBe(true);
    expect(isEmail('asha@example')).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@x.in`)).toBe(false);
    expect(cleanCode(' 123 456. ')).toBe('123456');
    expect(cleanCode('1234567')).toBe('123456');
    expect(isEmailCode('123456')).toBe(true);
    expect(isEmailCode('12345')).toBe(false);
  });

  it('waits 30 s before a new code', () => {
    expect(resendWaitSeconds(1_000, 1_000)).toBe(30);
    expect(resendWaitSeconds(1_000, 1_500)).toBe(30);
    expect(resendWaitSeconds(1_000, 29_500)).toBe(2);
    expect(resendWaitSeconds(1_000, 30_000)).toBe(1);
    expect(resendWaitSeconds(1_000, 31_000)).toBe(0);
    expect(resendWaitSeconds(1_000, 90_000)).toBe(0);
  });
});

describe('deleting an account signed in per phone', () => {
  const URL = 'https://api.example.in';
  const ID = '3f2a91c0-0000-4000-8000-000000000000';

  const setup = (reply: Response) => {
    const order: string[] = [];
    let userId: string | null = ID;
    const { blockStore, entries } = fakes({ stored: RESTORE_KEY });
    blockStore.delete.mockImplementation(async (key: string) => {
      order.push('blockStore.delete');
      return entries.delete(key);
    });
    const session = {
      authFetch: jest.fn(async (_url: string, _init?: RequestInit) => reply),
      clearLocal: jest.fn(async () => {
        order.push('clearLocal');
        userId = null;
      }),
      currentUserId: () => userId,
    };
    const pending = { get: async () => null, set: jest.fn(async () => undefined), clear: async () => undefined };
    const wipePhone = jest.fn(async () => {
      order.push('wipePhone');
    });
    const run = () =>
      deleteAccount(session, URL, {
        pending,
        wipePhone,
        forgetDevice: () => forgetRestoreKey(blockStore),
        mode: 'phone',
      });
    return { run, order, entries, blockStore, session, wipePhone };
  };

  const deleted = (accountDeleted: boolean) =>
    new Response(JSON.stringify({ dataDeleted: true, accountDeleted }), { status: 200 });

  it('deletes the Block Store entry once the server confirms, before signing out and clearing the phone', async () => {
    const { run, order, entries, blockStore } = setup(deleted(true));
    expect(await run()).toEqual({ ok: true, message: 'Your account and the data on this phone are deleted.' });
    expect(blockStore.delete).toHaveBeenCalledWith(RESTORE_KEY_ENTRY);
    expect(entries.has(RESTORE_KEY_ENTRY)).toBe(false);
    // Before signing out: the signed-out start-up would otherwise find the key.
    expect(order).toEqual(['blockStore.delete', 'clearLocal', 'wipePhone']);
  });

  it('keeps the entry while the server has not finished', async () => {
    for (const reply of [new Response(null, { status: 500 }), deleted(false)]) {
      const { run, entries, session, wipePhone } = setup(reply);
      expect((await run()).ok).toBe(false);
      expect(entries.get(RESTORE_KEY_ENTRY)).toBe(RESTORE_KEY);
      expect(session.clearLocal).not.toHaveBeenCalled();
      expect(wipePhone).not.toHaveBeenCalled();
    }
  });

  it('still finishes when Block Store fails', async () => {
    const { run, blockStore, wipePhone } = setup(deleted(true));
    blockStore.delete.mockRejectedValueOnce(new BlockStoreError('unavailable'));
    expect((await run()).ok).toBe(true);
    expect(wipePhone).toHaveBeenCalledTimes(1);
  });

  it('mentions no passkey', () => {
    expect(deletedMessage(ID, true, 'phone')).toBe('Your account and the data on this phone are deleted.');
    expect(deletedMessage(ID, false, 'phone')).toContain('some data is still on this phone');
    expect(deletedMessage(ID, false, 'phone')).not.toContain('passkey');
  });

  it('says how to finish when the session ended on the way', async () => {
    const order: string[] = [];
    let userId: string | null = ID;
    const result = await deleteAccount(
      {
        authFetch: jest.fn(async () => {
          // What session-core does when the refresh token is refused on the way.
          userId = null;
          throw new AuthApiError('invalid', 401);
        }),
        clearLocal: jest.fn(async () => {
          order.push('clearLocal');
        }),
        currentUserId: () => userId,
      },
      URL,
      {
        pending: { get: async () => null, set: async () => undefined, clear: async () => undefined },
        wipePhone: async () => undefined,
        forgetDevice: async () => {
          order.push('forgetDevice');
        },
        mode: 'phone',
      },
    );
    expect(result).toMatchObject({ ok: false, signedOut: true });
    expect(result.message).toContain('I already have an account');
    expect(result.message).not.toContain('passkey');
    expect(order).toEqual([]);
  });
});

describe('account email in Settings', () => {
  it('reads what GET /v1/me says about the email', () => {
    expect(parseAccountInfo({ userId: 'u', email: 'asha@example.in', emailVerified: true })).toEqual({
      email: 'asha@example.in',
      emailVerified: true,
    });
    expect(parseAccountInfo({ email: 'asha@example.in', emailVerified: false })).toEqual({
      email: 'asha@example.in',
      emailVerified: false,
    });
    // No email yet, however the server says it; never confirmed without one.
    for (const data of [{ email: null }, { email: '' }, {}, { email: '', emailVerified: true }]) {
      expect(parseAccountInfo(data)).toEqual({ email: null, emailVerified: false });
    }
    expect(parseAccountInfo({ email: 42 })).toBeNull();
    expect(parseAccountInfo(null)).toBeNull();
    expect(parseAccountInfo([])).toBeNull();
  });

  it('asks the data API with the session', async () => {
    const authFetch = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ email: 'asha@example.in', emailVerified: true }), { status: 200 }),
    );
    expect(await fetchAccountInfo(authFetch, 'https://api.example.in')).toEqual({
      email: 'asha@example.in',
      emailVerified: true,
    });
    expect(authFetch.mock.calls[0][0]).toBe('https://api.example.in/v1/me');
    expect(authFetch.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });

  it('rejects with a code the card can explain', async () => {
    const codeOf = async (authFetch: FetchLike) => {
      try {
        await fetchAccountInfo(authFetch, 'https://api.example.in');
      } catch (e) {
        return (e as AuthApiError).code;
      }
      return 'resolved';
    };
    expect(
      await codeOf(async () => {
        throw new AuthApiError('offline');
      }),
    ).toBe('offline');
    expect(
      await codeOf(async () => {
        throw new TypeError('Network request failed');
      }),
    ).toBe('offline');
    expect(await codeOf(async () => new Response(null, { status: 500 }))).toBe('server');
    expect(await codeOf(async () => new Response('<html>', { status: 200 }))).toBe('server');
  });
});
