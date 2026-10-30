import '@/sync/background';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/auth-state';
import { claimLocalData } from '@/auth/owner';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LockOffer, LockScreen } from '@/components/auth/lock-screen';
import { Onboarding } from '@/components/onboarding';
import { LockProvider, useLock } from '@/state/app-lock';
import { AppProvider, useApp } from '@/state/app-state';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AppProvider>
          <LockProvider>
            <Gate />
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
  const userId = auth.session?.user.id ?? null;
  const [claimedFor, setClaimedFor] = useState<string | null>(null);
  const ready = !auth.loading && lock.loaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    claimLocalData(repo, userId, resetAll).then(() => {
      if (!cancelled) setClaimedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [repo, userId, resetAll]);

  if (!ready) return null;

  if (!auth.previewSkipped) {
    if (!userId || auth.resetting) return <AuthScreen />;
    // Wait until any other account's data on this phone is gone.
    if (claimedFor !== userId) return null;
    if (lock.support === 'ready' && !lock.asked) return <LockOffer />;
  }

  return (
    <>
      {profile.onboarded ? <Stack screenOptions={{ headerShown: false }} /> : <Onboarding />}
      {lock.locked ? <LockScreen /> : null}
    </>
  );
}
