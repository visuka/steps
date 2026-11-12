/** The app locks again after this long in the background (e.g. a quick look at another app doesn't count). */
export const LOCK_AFTER_MS = 60_000;

export function shouldLock(backgroundAt: number | null, now: number): boolean {
  return backgroundAt !== null && now - backgroundAt >= LOCK_AFTER_MS;
}

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

/**
 * Where the app stands: still reading the secure store, nobody signed in,
 * signed in but behind the fingerprint lock, or open.
 */
export type AccessStatus = 'loading' | 'signed-out' | 'locked' | 'signed-in';

export function accessStatus(auth: AuthStatus, lock: { loaded: boolean; locked: boolean }): AccessStatus {
  if (auth === 'loading' || !lock.loaded) return 'loading';
  if (auth === 'signed-out') return 'signed-out';
  return lock.locked ? 'locked' : 'signed-in';
}

/**
 * A short piece of the account id, e.g. "3F2A91", so a person can tell
 * which account a phone is on (and quote it to support) without an email.
 * The same code the server puts in the passkey's name (stepsinfra
 * lambda_src/auth/index.mjs accountCode), so it matches what Google Password
 * Manager lists.
 */
export function accountCode(userId: string): string {
  return userId.slice(0, 6).toUpperCase();
}

/** The passkey's name in Google Password Manager. The server names it; this only repeats it. */
export function passkeyName(userId: string): string {
  return `Steps ${accountCode(userId)}`;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** A light check so a typo is caught on the phone; the server does the real one. */
export const isEmail = (email: string) => {
  const e = normalizeEmail(email);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
};

/** The codes in our emails are 6 digits (docs/phone-signin.md). */
export const isEmailCode = (code: string) => /^\d{6}$/.test(code);

/** Only the digits, at most 6: what people paste often has spaces or a full stop. */
export const cleanCode = (text: string) => text.replace(/\D/g, '').slice(0, 6);

/** "Send a new code" waits this long after the last one, so the first has time to arrive. */
export const RESEND_AFTER_MS = 30_000;

/** Whole seconds until a new code can be asked for; 0 when it can be now. */
export function resendWaitSeconds(sentAt: number, now: number): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000));
}
