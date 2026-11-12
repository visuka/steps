import { describe, expect, it, jest } from '@jest/globals';

import { isPasskeyError, makePasskeys, PasskeyError, type PasskeysNative, toPasskeyError } from '../../../modules/passkeys/passkeys';

/** What Expo hands JS when a Kotlin AsyncFunction rejects with a CodedException. */
const nativeError = (code: string, message = `Call to function 'Passkeys.get' has been rejected. ${code}`) =>
  Object.assign(new Error(message), { code });

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (isPasskeyError(e)) return e.code;
    throw e;
  }
  throw new Error('expected a rejection');
}

function native(overrides: Partial<PasskeysNative> = {}): PasskeysNative {
  return {
    isSupported: () => true,
    create: async () => '{"id":"made"}',
    get: async () => '{"id":"used"}',
    ...overrides,
  };
}

describe('toPasskeyError', () => {
  it('maps each native code', () => {
    expect(toPasskeyError(nativeError('ERR_PASSKEY_CANCELLED')).code).toBe('cancelled');
    expect(toPasskeyError(nativeError('ERR_PASSKEY_NO_CREDENTIALS')).code).toBe('no-credentials');
    expect(toPasskeyError(nativeError('ERR_PASSKEY_NOT_SUPPORTED')).code).toBe('not-supported');
    expect(toPasskeyError(nativeError('ERR_PASSKEY_INTERRUPTED')).code).toBe('interrupted');
    expect(toPasskeyError(nativeError('ERR_PASSKEY_FAILED')).code).toBe('failed');
  });

  it('calls anything unknown a failure and keeps its message for logs', () => {
    const e = toPasskeyError(nativeError('ERR_UNEXPECTED', 'boom'));
    expect(e.code).toBe('failed');
    expect(e.message).toBe('boom');
    expect(toPasskeyError(null).code).toBe('failed');
    expect(toPasskeyError({ code: 'toString' }).code).toBe('failed');
  });

  it('leaves a PasskeyError as it is', () => {
    const e = new PasskeyError('cancelled');
    expect(toPasskeyError(e)).toBe(e);
  });
});

describe('makePasskeys', () => {
  it('passes JSON through both ways', async () => {
    const get = jest.fn(async (_json: string) => '{"id":"used"}');
    const passkeys = makePasskeys(native({ get }));
    expect(await passkeys.get('{"challenge":"c"}')).toBe('{"id":"used"}');
    expect(get).toHaveBeenCalledWith('{"challenge":"c"}');
    expect(await passkeys.create('{"challenge":"c"}')).toBe('{"id":"made"}');
    expect(passkeys.isSupported()).toBe(true);
  });

  it('turns native rejections into codes', async () => {
    const passkeys = makePasskeys(
      native({
        get: async () => {
          throw nativeError('ERR_PASSKEY_NO_CREDENTIALS');
        },
        create: async () => {
          throw nativeError('ERR_PASSKEY_CANCELLED');
        },
      }),
    );
    expect(await codeOf(passkeys.get('{}'))).toBe('no-credentials');
    expect(await codeOf(passkeys.create('{}'))).toBe('cancelled');
  });

  it('treats an empty answer as a failure', async () => {
    const passkeys = makePasskeys(native({ get: async () => '' }));
    expect(await codeOf(passkeys.get('{}'))).toBe('failed');
    expect(await codeOf(passkeys.get(''))).toBe('failed');
  });

  it('reports not supported where there is no native module (iOS, web)', async () => {
    const passkeys = makePasskeys(null);
    expect(passkeys.isSupported()).toBe(false);
    expect(await codeOf(passkeys.get('{}'))).toBe('not-supported');
    expect(await codeOf(passkeys.create('{}'))).toBe('not-supported');
  });
});
