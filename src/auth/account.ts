import { AuthApiError, type FetchLike, isAuthApiError } from '@/auth/auth-api';
import { passkeyName } from '@/auth/rules';
import type { Session } from '@/auth/session-core';
import { MESSAGES } from '@/auth/sign-in';
import { APP_NAME, type SignInMode } from '@/constants/app';

/**
 * `message` (when ok): what the sign-in screen says once the account is gone.
 * `signedOut`: the session ended on the way (its refresh token was refused), so this try deleted
 * nothing; the sign-in screen shows `message`.
 */
export type DeleteResult = { ok: true; message: string } | { ok: false; message: string; signedOut?: boolean };

/**
 * The account whose deletion the server left half done (secure store
 * `steps.deletePending`). Any sign-in, sign-up or refresh clears it
 * (session.ts): the server only gives tokens to an open account.
 */
export interface PendingDelete {
  get(): Promise<string | null>;
  set(userId: string): Promise<void>;
  clear(): Promise<void>;
}

const NOT_DELETED = "Couldn't delete your account. Try again.";
// Without the note, the app can't tell why the session ended: the deletion
// may have gone through with its reply lost, and then signing in can't work.
const SIGN_IN_TO_FINISH = `Sign in again to finish deleting your account. If your passkey doesn't work any more, the account is already deleted. Uninstall ${APP_NAME} to clear its data from this phone.`;
// Phone sign-in has no passkey; the way back in is the email (docs/phone-signin.md).
const SIGN_IN_TO_FINISH_PHONE = `This phone was signed out before your account was deleted. To finish, tap “I already have an account”, sign in with your email and delete it again in Settings. If that doesn't work, the account is already deleted. Uninstall ${APP_NAME} to clear its data from this phone.`;

/**
 * What the sign-in screen says once the account is gone; the Account card
 * with the code is gone by then. `phoneCleared`: the data on this phone went
 * too. `mode`: with phone sign-in there is no passkey to mention.
 */
export function deletedMessage(userId: string | null, phoneCleared = true, mode: SignInMode = 'passkey'): string {
  const deleted = phoneCleared
    ? 'Your account and the data on this phone are deleted.'
    : `Your account is deleted, but some data is still on this phone. Uninstall ${APP_NAME} to remove it.`;
  if (mode === 'phone') return deleted;
  const name = userId ? `the passkey “${passkeyName(userId)}”` : `the ${APP_NAME} passkey`;
  return `${deleted} You can also remove ${name} in Google Password Manager.`;
}

/**
 * DELETE /v1/me on the Steps API deletes the person's data, passkey records,
 * email, restore keys and refresh tokens. Only then is the session forgotten
 * here, the same way signing out does, `forgetDevice` deletes this phone's
 * restore key from Block Store (phone sign-in), and `wipePhone` clears the
 * data on this phone too (the reset behind "Delete all app data"): they
 * asked for all of it to go.
 */
export async function deleteAccount(
  session: Pick<Session, 'authFetch' | 'clearLocal' | 'currentUserId'>,
  stepsApiUrl: string,
  {
    pending,
    wipePhone,
    forgetDevice,
    mode = 'passkey',
  }: {
    pending: PendingDelete;
    wipePhone: () => Promise<void>;
    forgetDevice?: () => Promise<void>;
    mode?: SignInMode;
  },
): Promise<DeleteResult> {
  const userId = session.currentUserId();

  const finish = async (): Promise<DeleteResult> => {
    await pending.clear().catch(() => undefined);
    // Before signing out: the signed-out start-up looks in Block Store, and
    // the key of a deleted account must not be found there.
    await forgetDevice?.().catch(() => undefined);
    // Signed out first, so the sign-in screen (already saying what happened)
    // covers the app while its data goes.
    await session.clearLocal();
    try {
      await wipePhone();
      return { ok: true, message: deletedMessage(userId, true, mode) };
    } catch {
      return { ok: true, message: deletedMessage(userId, false, mode) };
    }
  };

  const failed = async (message: string): Promise<DeleteResult> => {
    if (session.currentUserId() !== null) return { ok: false, message };
    // An earlier try shut the account for good: the server answers
    // `accountDeleted: false` only when no refresh or sign-in can work for it
    // again. No token came since (that clears the note), so that's why the
    // refresh was refused, and nothing is left to finish.
    const half = await pending.get().catch(() => null);
    if (userId && half === userId) return finish();
    // Signed out on the way: the card that would show the message is gone,
    // so the sign-in screen says what's next.
    return { ok: false, signedOut: true, message: mode === 'phone' ? SIGN_IN_TO_FINISH_PHONE : SIGN_IN_TO_FINISH };
  };

  let res: Response;
  try {
    res = await session.authFetch(`${stepsApiUrl}/v1/me`, { method: 'DELETE' });
  } catch (e) {
    return failed(isAuthApiError(e) && e.code === 'offline' ? MESSAGES.offline : NOT_DELETED);
  }
  if (!res.ok) return failed(NOT_DELETED);
  let body: unknown = null;
  try {
    body = res.status === 204 ? null : await res.json();
  } catch {
    body = null;
  }
  // The data went but the sign-in didn't: stay signed in so trying again can
  // finish it, and remember it in case the session ends before then.
  if ((body as { accountDeleted?: unknown } | null)?.accountDeleted === false) {
    if (userId) await pending.set(userId).catch(() => undefined);
    return failed("Your data is deleted, but your sign-in isn't yet. Try again.");
  }
  return finish();
}

/** Settings → Account: the account's email and whether it's confirmed (GET /v1/me). */
export interface AccountInfo {
  email: string | null;
  emailVerified: boolean;
}

export function parseAccountInfo(data: unknown): AccountInfo | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { email, emailVerified } = data as { email?: unknown; emailVerified?: unknown };
  // An account without an email yet may come as null, '' or no field at all.
  if (email !== undefined && email !== null && typeof email !== 'string') return null;
  const address = typeof email === 'string' && email.length > 0 && email.length <= 254 ? email : null;
  return { email: address, emailVerified: address !== null && emailVerified === true };
}

/** Rejects with an AuthApiError: `offline`, `signed_out`, or `server` for any other failure. */
export async function fetchAccountInfo(authFetch: FetchLike, stepsApiUrl: string): Promise<AccountInfo> {
  let res: Response;
  try {
    res = await authFetch(`${stepsApiUrl}/v1/me`, { method: 'GET', headers: { Accept: 'application/json' } });
  } catch (e) {
    throw isAuthApiError(e) ? e : new AuthApiError('offline');
  }
  if (!res.ok) throw new AuthApiError('server', res.status);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const info = parseAccountInfo(data);
  if (!info) throw new AuthApiError('server', res.status);
  return info;
}
