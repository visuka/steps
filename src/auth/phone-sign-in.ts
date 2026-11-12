import {
  type AuthApi,
  type DeviceTokens,
  type FetchLike,
  isAuthApiError,
  isRestoreKey,
  type Tokens,
} from '@/auth/auth-api';
import type { LockSupport, UnlockResult } from '@/auth/device-lock';
import { isEmail, isEmailCode, normalizeEmail } from '@/auth/rules';
import { MESSAGES } from '@/auth/sign-in';
import { APP_NAME } from '@/constants/app';

import { type BlockStoreApi, isBlockStoreError } from '../../modules/blockstore/blockstore';

/**
 * Sign-in per phone, with the email to get the account back
 * (docs/phone-signin.md). The refresh token stays in the secure store
 * (session.ts); this phone's restore key goes only to Block Store, under
 * this one entry.
 */
export const RESTORE_KEY_ENTRY = 'steps_restore_key';

export interface PhoneDeps {
  api: Pick<AuthApi, 'deviceRegister' | 'deviceRestore' | 'emailStart' | 'emailFinish' | 'recoverStart' | 'recoverFinish'>;
  blockStore: Pick<BlockStoreApi, 'store' | 'retrieve' | 'delete'>;
  /** Keeps the tokens (session.start). */
  start(tokens: Tokens): Promise<void>;
  /** session.authFetch: adds the access token, for the email routes. */
  authFetch: FetchLike;
  /** The phone's own fingerprint or PIN check (src/auth/device-lock.ts). */
  device: {
    lockSupport(): Promise<LockSupport>;
    unlockWithDevice(promptMessage: string): Promise<UnlockResult>;
  };
}

export const PHONE_MESSAGES = {
  enterEmail: 'Enter your email address.',
  badEmail: "That email address doesn't look right. Check it and try again.",
  enterCode: 'Enter the 6-digit code from the email.',
  badCode: 'That code is wrong or too old. Check the email, or send a new code.',
  emailUnavailable: "We can't send emails right now. Your account works; confirm your email later in Settings.",
  emailUnavailableLater: "We can't send emails right now. Try again later.",
  // The server allows a few codes per account and email per day.
  codesLimited: 'Too many codes were sent today. Try again tomorrow.',
  noScreenLock: `This phone has no screen lock. ${APP_NAME} checks your fingerprint or PIN before making your account, so only you can open it. Set a screen lock in your phone's settings, then tap Continue again.`,
  lockFailed: "That didn't work. Try again.",
  savedSignInGone:
    'The sign-in saved on this phone no longer works. If you have an account, tap “I already have an account”.',
  // Block Store answered with an error, so it may still hold this phone's account.
  blockStoreFailed:
    "This phone's Google services didn't answer, so we couldn't check for your account. Wait a minute, then try again.",
} as const;

/** Where a message is shown; a few errors read differently there. */
export type PhoneStep = 'register' | 'restore' | 'email' | 'code' | 'recover';

/** Plain words for a failed call in the phone sign-in. */
export function phoneMessage(e: unknown, step: PhoneStep): string {
  if (!isAuthApiError(e)) return MESSAGES.unknown;
  switch (e.code) {
    case 'offline':
      return MESSAGES.offline;
    case 'adult_required':
      return MESSAGES.adultsOnly;
    case 'bad_email':
      return PHONE_MESSAGES.badEmail;
    case 'bad_code':
      return PHONE_MESSAGES.badCode;
    case 'email_unavailable':
      return step === 'email' ? PHONE_MESSAGES.emailUnavailable : PHONE_MESSAGES.emailUnavailableLater;
    case 'rate_limited':
      if (step === 'register') return MESSAGES.signUpLimited;
      return step === 'restore' ? MESSAGES.rateLimited : PHONE_MESSAGES.codesLimited;
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

/** Saves this phone's restore key; false where it couldn't (no Block Store, iOS, web). Never throws. */
export async function keepRestoreKey(blockStore: PhoneDeps['blockStore'], restoreKey: string): Promise<boolean> {
  try {
    return await blockStore.store(RESTORE_KEY_ENTRY, restoreKey);
  } catch {
    return false;
  }
}

/** Deletes the restore key from Block Store. Best effort: a key that outlives its account is refused later. */
export async function forgetRestoreKey(blockStore: PhoneDeps['blockStore']): Promise<void> {
  try {
    await blockStore.delete(RESTORE_KEY_ENTRY);
  } catch {
    // device/restore answers `invalid` for it, and that deletes it again.
  }
}

/** The session keeps the tokens only; the restore key never reaches the secure store. */
function sessionTokens({ restoreKey: _restoreKey, ...tokens }: DeviceTokens): Tokens {
  return tokens;
}

/**
 * What Block Store holds for this phone:
 * - `key`: a restore key, maybe of an account still open.
 * - `empty`: read, and nothing usable there.
 * - `unavailable`: no Block Store here (no or old Play services). Nothing
 *   can be read now, so nothing may be written either: it may come back.
 * - `unknown`: Block Store failed (busy, timed out); a key may be there.
 */
type SavedKey = { kind: 'key'; key: string } | { kind: 'empty' } | { kind: 'unavailable' } | { kind: 'unknown' };

async function readRestoreKey(blockStore: PhoneDeps['blockStore']): Promise<SavedKey> {
  let key: string | null;
  try {
    key = await blockStore.retrieve(RESTORE_KEY_ENTRY);
  } catch (e) {
    return isBlockStoreError(e) && e.code === 'unavailable' ? { kind: 'unavailable' } : { kind: 'unknown' };
  }
  if (!key) return { kind: 'empty' };
  // Not what the server hands out: no account can have it.
  if (!isRestoreKey(key)) {
    await forgetRestoreKey(blockStore);
    return { kind: 'empty' };
  }
  return { kind: 'key', key };
}

/**
 * - `none`: Block Store has no key (first open, or nothing to read it with).
 * - `restored`: signed back in to the same account.
 * - `invalid`: the server refused the key (deleted account, unknown key); it's deleted here too.
 * - `error`: no answer that says either; the key stays for another try.
 *   `found`: there is a key (else Block Store itself didn't answer).
 */
export type RestoreResult =
  | { kind: 'none' }
  | { kind: 'restored' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string; found: boolean };

async function restoreWith(deps: PhoneDeps, key: string): Promise<RestoreResult> {
  try {
    await deps.start(await deps.api.deviceRestore(key));
    return { kind: 'restored' };
  } catch (e) {
    // Only the server's own refusal deletes the key: it's the only copy, and
    // a bare 401 could come from something in between (a Wi-Fi login page).
    if (isAuthApiError(e) && e.code === 'invalid' && e.status === 401 && e.reason === 'invalid') {
      await forgetRestoreKey(deps.blockStore);
      return { kind: 'invalid' };
    }
    return { kind: 'error', message: phoneMessage(e, 'restore'), found: true };
  }
}

/**
 * While signed out (at start-up, or when a session ends during the run): a
 * reinstall, or a new phone set up from the Google backup, still has this
 * phone's restore key in Block Store. `onFound`: there is a key, so the
 * network call that follows is worth showing ("Welcome back").
 */
export async function restoreOnStart(deps: PhoneDeps, onFound?: () => void): Promise<RestoreResult> {
  const saved = await readRestoreKey(deps.blockStore);
  // Not "nothing there": the first-open screen would then make a second account.
  if (saved.kind === 'unknown') return { kind: 'error', message: PHONE_MESSAGES.blockStoreFailed, found: false };
  if (saved.kind !== 'key') return { kind: 'none' };
  onFound?.();
  return restoreWith(deps, saved.key);
}

/**
 * Runs the restore one at a time: at start-up, from "Try again", and again
 * whenever a session ends during the run (a refused refresh, say), when this
 * phone's key may still sign it back in. `seen` gets every account id the app
 * shows; `paused` holds it off while the account is being deleted (its key
 * goes with it, and the deletion's own note stays on screen).
 */
export function restoreRunner(run: (onFound?: () => void) => Promise<void>) {
  let shown: string | null = null;
  let running: Promise<void> | null = null;
  let paused = false;
  const once = (onFound?: () => void) => {
    running ??= run(onFound)
      .catch(() => undefined)
      .finally(() => {
        running = null;
      });
    return running;
  };
  return {
    run: once,
    seen(userId: string | null) {
      const ended = shown !== null && userId === null;
      shown = userId;
      if (ended && !paused) void once();
    },
    async paused<T>(work: () => Promise<T>): Promise<T> {
      paused = true;
      try {
        return await work();
      } finally {
        paused = false;
      }
    },
  };
}

/**
 * - `sent`: a code is on its way to `email` (or, when another account
 *   confirmed that email, a note saying so; the server answers the same).
 * - `unavailable`: the server can't send emails now; the account works without.
 */
export type EmailSendResult =
  | { kind: 'sent'; email: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string };

function emailProblem(email: string): string | null {
  if (!email) return PHONE_MESSAGES.enterEmail;
  return isEmail(email) ? null : PHONE_MESSAGES.badEmail;
}

/**
 * `email/start` for the signed-in account. `first`: right after the account
 * was made, where an email that can't be sent is no reason to stop.
 */
export async function sendEmailCode(deps: PhoneDeps, email: string, when: 'first' | 'later'): Promise<EmailSendResult> {
  const address = normalizeEmail(email);
  const problem = emailProblem(address);
  if (problem) return { kind: 'error', message: problem };
  try {
    await deps.api.emailStart(address, deps.authFetch);
    return { kind: 'sent', email: address };
  } catch (e) {
    if (isAuthApiError(e) && e.code === 'email_unavailable') {
      return {
        kind: 'unavailable',
        message: when === 'first' ? PHONE_MESSAGES.emailUnavailable : PHONE_MESSAGES.emailUnavailableLater,
      };
    }
    return { kind: 'error', message: phoneMessage(e, 'email') };
  }
}

export type ConfirmResult = { kind: 'confirmed'; email: string } | { kind: 'error'; message: string };

/** `email/finish`: the code from the email confirms it for the signed-in account. */
export async function confirmEmailCode(deps: PhoneDeps, code: string): Promise<ConfirmResult> {
  if (!isEmailCode(code)) return { kind: 'error', message: PHONE_MESSAGES.enterCode };
  try {
    const status = await deps.api.emailFinish(code, deps.authFetch);
    if (!status.verified) return { kind: 'error', message: MESSAGES.unknown };
    return { kind: 'confirmed', email: status.email };
  } catch (e) {
    return { kind: 'error', message: phoneMessage(e, 'code') };
  }
}

/** The phone's fingerprint or PIN prompt; `no-lock` when the phone has no screen lock at all. */
export async function checkScreenLock(device: PhoneDeps['device']): Promise<UnlockResult> {
  try {
    if ((await device.lockSupport()) === 'no-lock') return 'no-lock';
    return await device.unlockWithDevice(`Confirm it's you to make your ${APP_NAME} account`);
  } catch {
    return 'failed';
  }
}

/**
 * - `signed-in`: the account exists and the session holds it. `sent` says
 *   how the email went; `restoreKeyKept` whether Block Store has the key.
 * - `restored`: this phone already had an account, still open; signed in
 *   to that one instead (no new account, no email step).
 * - `cancelled`: the person closed the fingerprint prompt; say nothing.
 */
export type CreateResult =
  | { kind: 'signed-in'; email: string; sent: EmailSendResult; restoreKeyKept: boolean }
  | { kind: 'restored' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * First open: 18+ and an email, the phone's fingerprint check, a new
 * account, then a code to the email. The restore key is saved before the
 * session starts, so a reinstall can find the account even if the app stops
 * right after.
 *
 * Block Store is read first and only written after a read that found no
 * usable key: a key there may be the only way back in to an account (one
 * signed out during the run, or one whose session never started), and
 * writing over it would lose that account.
 */
export async function createPhoneAccount(
  deps: PhoneDeps,
  { adult, email }: { adult: boolean; email: string },
): Promise<CreateResult> {
  if (!adult) return { kind: 'error', message: MESSAGES.adultsOnly };
  const address = normalizeEmail(email);
  const problem = emailProblem(address);
  if (problem) return { kind: 'error', message: problem };

  const lock = await checkScreenLock(deps.device);
  if (lock === 'cancelled') return { kind: 'cancelled' };
  if (lock === 'no-lock') return { kind: 'error', message: PHONE_MESSAGES.noScreenLock };
  if (lock !== 'ok') return { kind: 'error', message: PHONE_MESSAGES.lockFailed };

  const saved = await readRestoreKey(deps.blockStore);
  if (saved.kind === 'unknown') return { kind: 'error', message: PHONE_MESSAGES.blockStoreFailed };
  if (saved.kind === 'key') {
    const restored = await restoreWith(deps, saved.key);
    if (restored.kind === 'restored') return { kind: 'restored' };
    // No clear answer: the key may still work, so no new account over it.
    if (restored.kind === 'error') return { kind: 'error', message: restored.message };
    // `invalid`: refused and deleted, so a new account can take its place.
  }

  let tokens: DeviceTokens;
  try {
    tokens = await deps.api.deviceRegister(true);
  } catch (e) {
    return { kind: 'error', message: phoneMessage(e, 'register') };
  }
  // Unread is not empty: Play services coming back mid-sign-up would let this write over a key it never saw.
  const restoreKeyKept = saved.kind !== 'unavailable' && (await keepRestoreKey(deps.blockStore, tokens.restoreKey));
  try {
    await deps.start(sessionTokens(tokens));
  } catch {
    // The secure store refused the token. Block Store has the key, so the next start can still sign in.
    return { kind: 'error', message: MESSAGES.unknown };
  }
  return { kind: 'signed-in', email: address, sent: await sendEmailCode(deps, address, 'first'), restoreKeyKept };
}

export type RecoverStartResult = { kind: 'sent'; email: string } | { kind: 'error'; message: string };

/** "I already have an account": a code goes to the email if a confirmed account has it. */
export async function startRecovery(deps: PhoneDeps, email: string): Promise<RecoverStartResult> {
  const address = normalizeEmail(email);
  const problem = emailProblem(address);
  if (problem) return { kind: 'error', message: problem };
  try {
    await deps.api.recoverStart(address);
    return { kind: 'sent', email: address };
  } catch (e) {
    return { kind: 'error', message: phoneMessage(e, 'recover') };
  }
}

export type RecoverFinishResult =
  | { kind: 'signed-in'; restoreKeyKept: boolean }
  | { kind: 'error'; message: string };

/** The code signs this phone in to the account; the phone gets its own restore key. */
export async function finishRecovery(deps: PhoneDeps, email: string, code: string): Promise<RecoverFinishResult> {
  const address = normalizeEmail(email);
  const problem = emailProblem(address);
  if (problem) return { kind: 'error', message: problem };
  if (!isEmailCode(code)) return { kind: 'error', message: PHONE_MESSAGES.enterCode };
  let tokens: DeviceTokens;
  try {
    tokens = await deps.api.recoverFinish(address, code);
  } catch (e) {
    return { kind: 'error', message: phoneMessage(e, 'code') };
  }
  const restoreKeyKept = await keepRestoreKey(deps.blockStore, tokens.restoreKey);
  try {
    await deps.start(sessionTokens(tokens));
  } catch {
    return { kind: 'error', message: MESSAGES.unknown };
  }
  return { kind: 'signed-in', restoreKeyKept };
}
