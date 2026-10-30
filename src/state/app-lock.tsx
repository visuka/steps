import { createContext, type ReactNode, use, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { type LockSupport, lockSupport, type UnlockResult, unlockWithDevice } from '@/auth/device-lock';
import { shouldLock } from '@/auth/rules';
import { APP_NAME } from '@/constants/app';
import { useApp } from '@/state/app-state';

const LOCK_KEY = 'appLock';
const LOCK_ASKED_KEY = 'appLockAsked';

interface LockContextValue {
  /** False until the saved choice has been read. */
  loaded: boolean;
  support: LockSupport;
  enabled: boolean;
  /** Whether the "use your fingerprint?" question has been answered on this phone. */
  asked: boolean;
  locked: boolean;
  /** Turning the lock on or off asks for the fingerprint first. */
  setEnabled(on: boolean): Promise<UnlockResult>;
  markAsked(): Promise<void>;
  unlock(): Promise<UnlockResult>;
  /** Signing in with the password proves who it is; no need to ask again straight after. */
  release(): void;
}

const LockContext = createContext<LockContextValue | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const { repo, dataVersion } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [support, setSupport] = useState<LockSupport>('unsupported');
  const [enabled, setEnabledState] = useState(false);
  const [asked, setAsked] = useState(false);
  const [locked, setLocked] = useState(false);
  const firstLoad = useRef(true);
  const backgroundAt = useRef<number | null>(null);

  // Re-read after "delete all data", which clears the saved choice.
  useEffect(() => {
    let cancelled = false;
    Promise.all([repo.getKv<boolean>(LOCK_KEY), repo.getKv<boolean>(LOCK_ASKED_KEY), lockSupport()]).then(
      ([on, wasAsked, s]) => {
        if (cancelled) return;
        setEnabledState(!!on);
        setAsked(!!wasAsked);
        setSupport(s);
        if (firstLoad.current) {
          firstLoad.current = false;
          setLocked(!!on);
        }
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repo, dataVersion]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active') {
        if (enabled && shouldLock(backgroundAt.current, Date.now())) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const save = useCallback(
    async (on: boolean) => {
      await repo.setKv(LOCK_KEY, on);
      await repo.setKv(LOCK_ASKED_KEY, true);
      setEnabledState(on);
      setAsked(true);
    },
    [repo],
  );

  const setEnabled = useCallback(
    async (on: boolean) => {
      const result = await unlockWithDevice(on ? `Use this to open ${APP_NAME}` : `Turn off the ${APP_NAME} lock`);
      if (result === 'ok') await save(on);
      // The phone's screen lock was removed: nothing left to check against.
      if (result === 'no-lock') await save(false);
      return result;
    },
    [save],
  );

  const markAsked = useCallback(async () => {
    await repo.setKv(LOCK_ASKED_KEY, true);
    setAsked(true);
  }, [repo]);

  const unlock = useCallback(async () => {
    const result = await unlockWithDevice(`Unlock ${APP_NAME}`);
    if (result === 'ok') setLocked(false);
    if (result === 'no-lock') {
      await save(false);
      setLocked(false);
    }
    return result;
  }, [save]);

  const release = useCallback(() => setLocked(false), []);

  const value: LockContextValue = {
    loaded,
    support,
    enabled,
    asked,
    locked: enabled && locked,
    setEnabled,
    markAsked,
    unlock,
    release,
  };
  return <LockContext value={value}>{children}</LockContext>;
}

export function useLock(): LockContextValue {
  const ctx = use(LockContext);
  if (!ctx) throw new Error('useLock must be used inside LockProvider');
  return ctx;
}
