import '@/sync/background';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAccess, useAuth } from '@/auth/auth-state';
import { claimLocalData } from '@/auth/owner';
import { carriedOverAccount } from '@/auth/session-storage';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LockOffer, LockScreen } from '@/components/auth/lock-screen';
import { Onboarding } from '@/components/onboarding';
import { LockProvider, useLock } from '@/state/app-lock';
import { AppProvider, useApp } from '@/state/app-state';
import { PremiumProvider } from '@/state/use-premium';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AppProvider>
          <LockProvider>
            <PremiumProvider>
              <Gate />
            </PremiumProvider>
          </LockProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Rendered once the database and profile have loaded: sign-in, then the
 * fingerprint question (once per phone), then onboarding, then the app. The
 * tabs live in (tabs)/; Settings and the walk screens are pushed over them.
 */
function Gate() {
  const { repo, profile, resetAll } = useApp();
  const auth = useAuth();
  const lock = useLock();
  const access = useAccess();
  const userId = auth.userId;
  const [claimedFor, setClaimedFor] = useState<string | null>(null);
  const ready = access !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    claimLocalData(repo, userId, resetAll, carriedOverAccount).then(() => {
      if (!cancelled) setClaimedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [repo, userId, resetAll]);

  if (!ready) return null;

  if (!auth.previewSkipped) {
    // A new phone account stays on the sign-in screens until its email step is done or put off.
    if (access === 'signed-out' || !userId || auth.confirmingEmail) return <AuthScreen />;
    // Wait until any other account's data on this phone is gone.
    if (claimedFor !== userId) return null;
    if (lock.support === 'ready' && !lock.asked) return <LockOffer />;
  }

  return (
    <>
      {profile.onboarded ? <Stack screenOptions={{ headerShown: false }} /> : <Onboarding />}
      {access === 'locked' ? <LockScreen /> : null}
    </>
  );
}
