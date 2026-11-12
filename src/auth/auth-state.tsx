import { createContext, type ReactNode, use, useCallback, useEffect, useState } from 'react';

import { deleteAccount, deletedMessage, type DeleteResult } from '@/auth/account';
import { authApi } from '@/auth/auth-api';
import { lockSupport, unlockWithDevice } from '@/auth/device-lock';
import {
  type ConfirmResult,
  confirmEmailCode,
  createPhoneAccount,
  type CreateResult,
  type EmailSendResult,
  finishRecovery,
  forgetRestoreKey,
  PHONE_MESSAGES,
  type PhoneDeps,
  type RecoverFinishResult,
  type RecoverStartResult,
  restoreOnStart,
  restoreRunner,
  sendEmailCode,
  startRecovery,
} from '@/auth/phone-sign-in';
import { type AccessStatus, accessStatus, type AuthStatus, normalizeEmail } from '@/auth/rules';
import { session } from '@/auth/session';
import { pendingDelete } from '@/auth/session-storage';
import { createAccountWithPasskey, type SignInResult, signInWithPasskey } from '@/auth/sign-in';
import { SIGN_IN_MODE, STEPS_API_URL } from '@/constants/app';
import { useLock } from '@/state/app-lock';

import { BlockStore } from '../../modules/blockstore';
import { Passkeys } from '../../modules/passkeys';

export type { AccessStatus, AuthStatus } from '@/auth/rules';

/**
 * Phone sign-in while signed out: `restoring` while Block Store's restore key
 * is on its way to the server ("Welcome back"); `failed` when that got no
 * clear answer, so the key is kept and it can be tried again. `found`: there
 * is a key (else Block Store itself didn't answer).
 */
export type RestoreState =
  | { state: 'idle' }
  | { state: 'restoring' }
  | { state: 'failed'; message: string; found: boolean };

interface AuthContextValue {
  /** `loading` until the saved session has been read from the secure store. */
  status: AuthStatus;
  userId: string | null;
  /** One line for the sign-in screen about why it's showing, e.g. after deleting the account. */
  notice: string | null;
  signIn(): Promise<SignInResult>;
  createAccount(adult: boolean): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** `wipePhone`: the app-data reset ("Delete all app data"), which lives in AppProvider below this one. */
  deleteAccount(wipePhone: () => Promise<void>): Promise<DeleteResult>;
  /** Web preview only: look around the demo data without an account. */
  previewSkipped: boolean;
  skipForPreview(): void;

  // Phone sign-in (SIGN_IN_MODE 'phone', docs/phone-signin.md).
  restore: RestoreState;
  retryRestore(): Promise<void>;
  createPhoneAccount(adult: boolean, email: string): Promise<CreateResult>;
  sendEmailCode(email: string, when: 'first' | 'later'): Promise<EmailSendResult>;
  confirmEmail(code: string): Promise<ConfirmResult>;
  startRecovery(email: string): Promise<RecoverStartResult>;
  finishRecovery(email: string, code: string): Promise<RecoverFinishResult>;
  /**
   * The email of an account made on this screen a moment ago, until its code
   * is in or put off: the sign-in screens stay up meanwhile, though the
   * session has started (src/app/_layout.tsx).
   */
  confirmingEmail: string | null;
  doneWithFirstEmail(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const deps = { api: authApi, passkeys: Passkeys, start: session.start };

const phoneDeps: PhoneDeps = {
  api: authApi,
  blockStore: BlockStore,
  start: session.start,
  authFetch: session.authFetch,
  device: { lockSupport, unlockWithDevice },
};

const IDLE: RestoreState = { state: 'idle' };

// Says only whether it worked: the key itself never goes to a log.
const noteRestoreKey = (kept: boolean) => {
  if (!kept) console.warn("Block Store: this phone's restore key wasn't saved; a reinstall will need the email.");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewSkipped, setPreviewSkipped] = useState(false);
  const [restore, setRestore] = useState<RestoreState>(IDLE);
  const [confirmingEmail, setConfirmingEmail] = useState<string | null>(null);

  // One restore at a time, run again when a session ends during the run: the
  // first-open screen would otherwise stand where this phone's account is.
  const [restorer] = useState(() =>
    restoreRunner(async (onFound) => {
      const result = await restoreOnStart(phoneDeps, () => {
        setRestore({ state: 'restoring' });
        onFound?.();
      });
      switch (result.kind) {
        case 'restored':
          setNotice(null);
          setRestore(IDLE);
          break;
        case 'invalid':
          setNotice(PHONE_MESSAGES.savedSignInGone);
          setRestore(IDLE);
          break;
        case 'error':
          // Signed in some other way meanwhile: there's nothing to try again.
          setRestore(
            session.currentUserId() ? IDLE : { state: 'failed', message: result.message, found: result.found },
          );
          break;
        default:
          setRestore(IDLE);
      }
    }),
  );

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      const id = session.currentUserId();
      setUserId(id);
      setStatus(id ? 'signed-in' : 'signed-out');
      // Signed in, however it happened: an earlier failed restore is old news.
      if (id) setRestore(IDLE);
      if (SIGN_IN_MODE === 'phone') restorer.seen(id);
    };
    const unsubscribe = session.subscribe(sync);
    session.load().then(async (id) => {
      if (cancelled) return;
      // Signed out with phone sign-in: a reinstall still has the restore key
      // in Block Store. Reading it is quick, so the splash stays up until
      // then; the sign-in with it shows its own screen.
      if (!id && SIGN_IN_MODE === 'phone') {
        await restorer.run(() => {
          if (!cancelled) sync();
        });
      }
      if (!cancelled) sync();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [restorer]);

  const signIn = useCallback(async () => {
    const result = await signInWithPasskey(deps);
    if (result.kind === 'signed-in') setNotice(null);
    return result;
  }, []);

  const createAccount = useCallback(async (adult: boolean) => {
    const result = await createAccountWithPasskey(deps, adult);
    if (result.kind === 'signed-in') setNotice(null);
    return result;
  }, []);

  const signOut = useCallback(() => session.signOut(), []);

  const removeAccount = useCallback(async (wipePhone: () => Promise<void>) => {
    // Set first, so the sign-in screen that replaces this one already says it.
    setNotice(deletedMessage(session.currentUserId(), true, SIGN_IN_MODE));
    // No restore when this signs out: the key goes with the account, and the note above stays.
    const result = await restorer.paused(() =>
      deleteAccount(session, STEPS_API_URL, {
        pending: pendingDelete,
        wipePhone,
        // The restore key of a deleted account is no use; phone sign-in only.
        forgetDevice: SIGN_IN_MODE === 'phone' ? () => forgetRestoreKey(BlockStore) : undefined,
        mode: SIGN_IN_MODE,
      }),
    );
    // Deleted (and whether this phone is clear), or signed out on the way
    // without deleting: either way the sign-in screen says which.
    setNotice(result.ok || result.signedOut ? result.message : null);
    return result;
  }, [restorer]);

  const makePhoneAccount = useCallback(async (adult: boolean, email: string) => {
    // Held before the session starts, so the app doesn't open over the code screen.
    setConfirmingEmail(normalizeEmail(email));
    const result = await createPhoneAccount(phoneDeps, { adult, email });
    if (result.kind !== 'signed-in') {
      setConfirmingEmail(null);
      // Back in the account this phone already had: there's no email step for it.
      if (result.kind === 'restored') setNotice(null);
      return result;
    }
    setNotice(null);
    noteRestoreKey(result.restoreKeyKept);
    return result;
  }, []);

  const recover = useCallback(async (email: string, code: string) => {
    const result = await finishRecovery(phoneDeps, email, code);
    if (result.kind === 'signed-in') {
      setNotice(null);
      noteRestoreKey(result.restoreKeyKept);
    }
    return result;
  }, []);

  const value: AuthContextValue = {
    status,
    userId,
    notice,
    signIn,
    createAccount,
    signOut,
    deleteAccount: removeAccount,
    previewSkipped,
    skipForPreview: () => setPreviewSkipped(true),
    restore,
    retryRestore: () => restorer.run(),
    createPhoneAccount: makePhoneAccount,
    sendEmailCode: (email, when) => sendEmailCode(phoneDeps, email, when),
    confirmEmail: (code) => confirmEmailCode(phoneDeps, code),
    startRecovery: (email) => startRecovery(phoneDeps, email),
    finishRecovery: recover,
    confirmingEmail,
    doneWithFirstEmail: () => setConfirmingEmail(null),
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Sign-in and the fingerprint lock together: loading, signed-out, locked or signed-in. */
export function useAccess(): AccessStatus {
  const { status } = useAuth();
  const lock = useLock();
  return accessStatus(status, lock);
}
