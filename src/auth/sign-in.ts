import { type AuthApi, isAuthApiError, type Tokens } from '@/auth/auth-api';
import { APP_NAME } from '@/constants/app';

import { isPasskeyError, PasskeyError, type PasskeysApi } from '../../modules/passkeys/passkeys';

export interface SignInDeps {
  api: Pick<AuthApi, 'loginOptions' | 'loginVerify' | 'registerOptions' | 'registerVerify'>;
  passkeys: Pick<PasskeysApi, 'get' | 'create'>;
  /** Keeps the tokens (session.start). */
  start(tokens: Tokens): Promise<void>;
}

/**
 * - `signed-in`: done.
 * - `new-here`: this phone has no passkey for us; ask the 18+ question and make one.
 * - `cancelled`: the person closed the sheet; say nothing.
 * - `error`: show `message`.
 */
export type SignInResult =
  | { kind: 'signed-in' }
  | { kind: 'new-here'; message?: string }
  | { kind: 'cancelled' }
  /** `detail`: what the phone said, for the log only. */
  | { kind: 'error'; message: string; detail?: string };

export const MESSAGES = {
  offline: 'No internet connection. Connect and try again.',
  notSupported: "This phone can't save passkeys. Set a screen lock and make sure you're signed in to Google.",
  // No account has the passkey: it was deleted, or the sign-up that made the passkey didn't finish.
  unknownCredential: "That passkey isn't linked to an account any more. Make a new one.",
  adultsOnly: `${APP_NAME} is for adults 18 and over.`,
  rateLimited: 'Too many tries. Wait a few minutes and try again.',
  // The server allows a set number of new accounts per network per India day; many phones share one address.
  signUpLimited: 'Too many new accounts were made on this network today. Try again tomorrow or on Wi-Fi.',
  busy: 'Sign-in is busy right now. Wait a minute and try again.',
  notReady: "Sign-in isn't ready yet. Try again later.",
  interrupted: 'That was interrupted. Try again.',
  invalid: "That didn't work. Try again.",
  unknown: 'Something went wrong. Try again.',
} as const;

/**
 * Plain words for a failed step, or null when there's nothing to say (the
 * person cancelled). `signUp`: the error came while making a new account.
 */
export function signInMessage(e: unknown, signUp = false): string | null {
  if (isPasskeyError(e)) {
    switch (e.code) {
      case 'cancelled':
        return null;
      case 'not-supported':
        return MESSAGES.notSupported;
      case 'interrupted':
        return MESSAGES.interrupted;
      default:
        return MESSAGES.unknown;
    }
  }
  if (isAuthApiError(e)) {
    switch (e.code) {
      case 'offline':
        return MESSAGES.offline;
      case 'unknown_credential':
        return MESSAGES.unknownCredential;
      case 'adult_required':
        return MESSAGES.adultsOnly;
      case 'rate_limited':
        return signUp ? MESSAGES.signUpLimited : MESSAGES.rateLimited;
      case 'busy':
        return MESSAGES.busy;
      case 'not_configured':
        return MESSAGES.notReady;
      case 'invalid':
        return MESSAGES.invalid;
      default:
        return MESSAGES.unknown;
    }
  }
  return MESSAGES.unknown;
}

/** The phone's JSON answer, checked enough to send on; the server verifies the rest. */
export function parseCredential(json: string): object {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new PasskeyError('failed', 'The passkey answer is not JSON');
  }
  const c = data as { id?: unknown; type?: unknown; response?: unknown } | null;
  if (
    !c ||
    typeof c !== 'object' ||
    Array.isArray(c) ||
    typeof c.id !== 'string' ||
    c.type !== 'public-key' ||
    typeof c.response !== 'object' ||
    c.response === null
  ) {
    throw new PasskeyError('failed', 'The passkey answer is missing fields');
  }
  return c;
}

const failure = (e: unknown, signUp = false): SignInResult => {
  const message = signInMessage(e, signUp);
  if (!message) return { kind: 'cancelled' };
  // People see the plain message; the phone's own words go to the log for whoever sets this up.
  if (isPasskeyError(e) && e.code === 'failed') return { kind: 'error', message, detail: e.message };
  return { kind: 'error', message };
};

/** Signs in with the passkey already on the phone (or synced to it from the Google account). */
export async function signInWithPasskey({ api, passkeys, start }: SignInDeps): Promise<SignInResult> {
  try {
    const { challengeId, options } = await api.loginOptions();
    const answer = await passkeys.get(JSON.stringify(options));
    await start(await api.loginVerify(challengeId, parseCredential(answer)));
    return { kind: 'signed-in' };
  } catch (e) {
    if (isPasskeyError(e) && e.code === 'no-credentials') return { kind: 'new-here' };
    // The passkey outlived its account, or its sign-up never finished; the only way on is a new one.
    if (isAuthApiError(e) && e.code === 'unknown_credential') {
      return { kind: 'new-here', message: MESSAGES.unknownCredential };
    }
    return failure(e);
  }
}

/** Makes a new account and its passkey. Only for people who said they're 18 or older. */
export async function createAccountWithPasskey({ api, passkeys, start }: SignInDeps, adult: boolean): Promise<SignInResult> {
  if (!adult) return { kind: 'error', message: MESSAGES.adultsOnly };
  try {
    const { challengeId, options } = await api.registerOptions(true);
    const answer = await passkeys.create(JSON.stringify(options));
    await start(await api.registerVerify(challengeId, parseCredential(answer)));
    return { kind: 'signed-in' };
  } catch (e) {
    return failure(e, true);
  }
}
