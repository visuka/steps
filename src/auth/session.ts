import { authApi } from '@/auth/auth-api';
import { createSession } from '@/auth/session-core';
import { pendingDelete, sessionStore } from '@/auth/session-storage';

export { isAuthApiError, type AuthErrorCode } from '@/auth/auth-api';

/**
 * The one session for the app. Other callers of our API (food lookups,
 * uploads) use `getAccessToken()` or `authFetch()`; both reject with an
 * AuthApiError, `signed_out` when nobody is signed in.
 */
export const session = createSession({
  api: authApi,
  store: sessionStore,
  fetch: (url, init) => fetch(url, init),
  // New tokens mean the account is open, so a half-done deletion noted
  // earlier can no longer explain a refused refresh.
  onTokens: () => pendingDelete.clear(),
});

export const getAccessToken = () => session.getAccessToken();
export const authFetch = (url: string, init?: RequestInit) => session.authFetch(url, init);
export const signOut = () => session.signOut();
