/** Matches the minimum set in the Supabase project (Authentication → Email). */
export const MIN_PASSWORD = 8;

/** The app locks again after this long in the background (e.g. reading the code email doesn't count). */
export const LOCK_AFTER_MS = 60_000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** A light check; Supabase does the real one. */
export const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

/** Supabase email codes are 6 digits by default; the project can raise it to 10. */
export const isCode = (code: string) => /^\d{6,10}$/.test(code.trim());

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.trim() !== password) return "Passwords can't start or end with a space.";
  return null;
}

export function shouldLock(backgroundAt: number | null, now: number): boolean {
  return backgroundAt !== null && now - backgroundAt >= LOCK_AFTER_MS;
}

/** The parts of a Supabase AuthError the messages depend on. */
interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

/** Plain words for the errors people actually hit; anything else shows Supabase's own message. */
export function authMessage(error: unknown): string {
  const e = (error ?? {}) as AuthErrorLike;
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) {
    return 'No internet connection. Connect and try again.';
  }
  switch (e.code) {
    case 'invalid_credentials':
      return 'Wrong email or password.';
    case 'email_not_confirmed':
      return 'Confirm your email first. We sent you a new code.';
    case 'user_already_exists':
    case 'email_exists':
      return 'This email already has an account. Sign in instead.';
    case 'weak_password':
      return `Choose a stronger password, at least ${MIN_PASSWORD} characters.`;
    case 'same_password':
      return 'Choose a password different from your old one.';
    case 'otp_expired':
      return 'That code is wrong or has expired. Ask for a new one.';
    case 'email_address_invalid':
      return 'That email address doesn’t look right.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many tries. Wait a few minutes and try again.';
    case 'signup_disabled':
      return 'New accounts are closed right now.';
  }
  if (e.status === 429) return 'Too many tries. Wait a few minutes and try again.';
  return e.message || 'Something went wrong. Try again.';
}
