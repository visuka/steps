import { createContext, type ReactNode, use, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/auth-state';
import { authFetch } from '@/auth/session';
import { STEPS_API_URL } from '@/constants/app';
import { scheduleMoodCheckIn } from '@/notifications/notify';
import {
  canPreviewFree,
  createPremiumStore,
  type Feature,
  fetchPremium,
  isLocked,
  onPremiumRequired,
  type PremiumSnapshot,
  type PremiumState,
  type PremiumStore,
  premiumOpen,
} from '@/premium/premium';
import { useApp } from '@/state/app-state';

const PremiumContext = createContext<PremiumStore | null>(null);

/**
 * The web preview in development has no account to ask about. It acts as a
 * tester's, so every screen can be reviewed, and the free app too with
 * "Preview as a free user".
 */
const WEB_PREVIEW: PremiumState = { premium: true, reason: 'testing', checkedAt: 0, account: null };

/**
 * Keeps Steps Premium up to date (src/premium/premium.ts): asks GET /v1/me
 * at start, when someone signs in and when the app comes to the front, and
 * goes free when a food route answers 402. Inside AppProvider (kv) and
 * AuthProvider (who is signed in).
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const { repo, profile } = useApp();
  const { userId } = useAuth();
  const [store] = useState(() =>
    createPremiumStore({
      storage: repo,
      fetchState: (account) => fetchPremium(authFetch, STEPS_API_URL, account),
    }),
  );
  const { open, loaded } = useSyncExternalStore(store.subscribe, store.get);

  useEffect(() => {
    store.load();
  }, [store]);

  useEffect(() => {
    store.setAccount(userId);
  }, [store, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') store.refresh();
    });
    const off = onPremiumRequired(() => store.denied());
    return () => {
      sub.remove();
      off();
    };
  }, [store]);

  // The evening mood check-in is premium: it rings only while premium is
  // open. The setting itself is kept, so it comes back with premium.
  const { enabled, hour } = profile.moodCheckIn;
  useEffect(() => {
    if (!loaded || !enabled) return;
    scheduleMoodCheckIn(open ? hour : null).catch(() => undefined);
  }, [loaded, open, enabled, hour]);

  return <PremiumContext value={store}>{children}</PremiumContext>;
}

export interface Premium extends PremiumSnapshot {
  isLocked(feature: Feature): boolean;
  /** Asks the server now ("Check again"). */
  refresh(): Promise<void>;
  setPreviewFree(on: boolean): Promise<void>;
}

/** Whether this account has premium, and which parts of the app are locked. The one place screens ask. */
export function usePremium(): Premium {
  const store = use(PremiumContext);
  if (!store) throw new Error('usePremium must be used inside PremiumProvider');
  const snapshot = useSyncExternalStore(store.subscribe, store.get);
  const { previewSkipped } = useAuth();
  const state = previewSkipped ? WEB_PREVIEW : snapshot.state;
  const open = premiumOpen(state, snapshot.previewFree);
  return {
    ...snapshot,
    state,
    open,
    canPreviewFree: canPreviewFree(state),
    isLocked: (feature) => isLocked(feature, open),
    refresh: () => store.refresh(true),
    setPreviewFree: store.setPreviewFree,
  };
}
