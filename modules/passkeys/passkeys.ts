/**
 * What can go wrong with a passkey, the same on every platform:
 * - `cancelled`: the person closed the sheet.
 * - `no-credentials`: this phone has no passkey for us (new here, or a new phone without sync).
 * - `not-supported`: the phone can't make or use passkeys (no screen lock, no Google account…).
 * - `interrupted`: something cut in; trying again usually works.
 * - `failed`: anything else; `message` says what, for logs, not for people.
 */
export type PasskeyErrorCode = 'cancelled' | 'no-credentials' | 'not-supported' | 'interrupted' | 'failed';

export class PasskeyError extends Error {
  readonly code: PasskeyErrorCode;

  constructor(code: PasskeyErrorCode, message: string = code) {
    super(message);
    this.name = 'PasskeyError';
    this.code = code;
  }
}

// Checked by name, not instanceof: subclassed Errors don't always survive transpiling.
export function isPasskeyError(e: unknown): e is PasskeyError {
  return e instanceof Error && e.name === 'PasskeyError' && typeof (e as PasskeyError).code === 'string';
}

/** The codes the Kotlin module rejects with (PasskeysModule.kt). */
const NATIVE_CODES = new Map<unknown, PasskeyErrorCode>([
  ['ERR_PASSKEY_CANCELLED', 'cancelled'],
  ['ERR_PASSKEY_NO_CREDENTIALS', 'no-credentials'],
  ['ERR_PASSKEY_NOT_SUPPORTED', 'not-supported'],
  ['ERR_PASSKEY_INTERRUPTED', 'interrupted'],
  ['ERR_PASSKEY_FAILED', 'failed'],
]);

export function toPasskeyError(e: unknown): PasskeyError {
  if (isPasskeyError(e)) return e;
  const native = (e ?? {}) as { code?: unknown; message?: unknown };
  const code = NATIVE_CODES.get(native.code) ?? 'failed';
  return new PasskeyError(code, typeof native.message === 'string' ? native.message : code);
}

/** The native module's own calls (Android only for now). */
export interface PasskeysNative {
  isSupported(): boolean;
  create(requestJson: string): Promise<string>;
  get(requestJson: string): Promise<string>;
}

export interface PasskeysApi {
  /** False where there is no passkey support at all yet (iOS, web). */
  isSupported(): boolean;
  /**
   * Makes a passkey. Takes PublicKeyCredentialCreationOptionsJSON and resolves the
   * RegistrationResponseJSON, both as JSON text. Rejects with a PasskeyError.
   */
  create(requestJson: string): Promise<string>;
  /**
   * Signs in with a passkey already on the phone. Takes
   * PublicKeyCredentialRequestOptionsJSON and resolves the AuthenticationResponseJSON.
   */
  get(requestJson: string): Promise<string>;
}

/**
 * Wraps the native module so every failure is a PasskeyError. A missing
 * module (iOS until there's an Apple developer account, the web preview)
 * reports `not-supported`.
 */
export function makePasskeys(native: PasskeysNative | null): PasskeysApi {
  const call = async (fn: 'create' | 'get', requestJson: string) => {
    if (!native) throw new PasskeyError('not-supported', 'No passkey support on this platform');
    if (typeof requestJson !== 'string' || requestJson.length === 0) {
      throw new PasskeyError('failed', `${fn}: empty request`);
    }
    let result: unknown;
    try {
      result = await native[fn](requestJson);
    } catch (e) {
      throw toPasskeyError(e);
    }
    if (typeof result !== 'string' || result.length === 0) throw new PasskeyError('failed', `${fn}: empty response`);
    return result;
  };

  return {
    isSupported: () => {
      try {
        return !!native?.isSupported();
      } catch {
        return false;
      }
    },
    create: (requestJson) => call('create', requestJson),
    get: (requestJson) => call('get', requestJson),
  };
}
