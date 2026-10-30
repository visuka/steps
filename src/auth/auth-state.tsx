import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { supabase } from '@/auth/supabase';

interface AuthContextValue {
  session: Session | null;
  /** True until the saved session has been read from the secure store. */
  loading: boolean;
  /**
   * A "forgot password" code signs the person in before they've picked a new
   * password; the sign-in screen stays up until they have.
   */
  resetting: boolean;
  setResetting(resetting: boolean): void;
  /** Web preview only: look around the demo data without an account. */
  previewSkipped: boolean;
  skipForPreview(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [previewSkipped, setPreviewSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    loading,
    resetting,
    setResetting,
    previewSkipped,
    skipForPreview: () => setPreviewSkipped(true),
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
