import '@/sync/background';

import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { BarlowCondensed_500Medium } from '@expo-google-fonts/barlow-condensed/500Medium';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, type Theme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';

import { AuthProvider, useAccess, useAuth } from '@/auth/auth-state';
import { claimLocalData } from '@/auth/owner';
import { carriedOverAccount } from '@/auth/session-storage';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ConfirmHost } from '@/components/confirm-host';
import { LockOffer, LockScreen } from '@/components/auth/lock-screen';
import { Onboarding } from '@/components/onboarding';
import { Colors, FontFiles, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LockProvider, useLock } from '@/state/app-lock';
import { AppProvider, useApp } from '@/state/app-state';
import { PremiumProvider } from '@/state/use-premium';

SplashScreen.preventAutoHideAsync();

/** The two faces of the park-track world, only the weights the type scale uses. */
const FONTS = {
  [FontFiles.regular]: Barlow_400Regular,
  [FontFiles.medium]: Barlow_500Medium,
  [FontFiles.semibold]: Barlow_600SemiBold,
  [FontFiles.bold]: Barlow_700Bold,
  [FontFiles.numeralMedium]: BarlowCondensed_500Medium,
  [FontFiles.numeral]: BarlowCondensed_600SemiBold,
};

/** Fonts not loaded by then are skipped, and the system font stands in, so the splash never hangs. */
const FONT_WAIT_MS = 3000;

function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONTS);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  return loaded || error !== null || gaveUp;
}

/** The navigators (stack, tabs) in the same colour roles and faces as the screens. */
function navigationTheme(dark: boolean): Theme {
  const c = Colors[dark ? 'dark' : 'light'];
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.surface,
      card: c.surfaceContainer,
      text: c.onSurface,
      border: c.outlineVariant,
      notification: c.error,
    },
    fonts: {
      regular: { fontFamily: Fonts.regular, fontWeight: 'normal' },
      medium: { fontFamily: Fonts.medium, fontWeight: 'normal' },
      bold: { fontFamily: Fonts.semibold, fontWeight: 'normal' },
      heavy: { fontFamily: Fonts.bold, fontWeight: 'normal' },
    },
  };
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const fontsReady = useAppFonts();
  const surface = Colors[dark ? 'dark' : 'light'].surface;

  // The window behind the app (seen under the keyboard and between screens) is the ground colour too.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(surface).catch(() => undefined);
  }, [surface]);

  return (
    <ThemeProvider value={navigationTheme(dark)}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AuthProvider>
        <AppProvider>
          <LockProvider>
            <PremiumProvider>
              <Gate fontsReady={fontsReady} surface={surface} />
              <ConfirmHost />
            </PremiumProvider>
          </LockProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Rendered once the database, the profile and the fonts have loaded: sign-in,
 * then the fingerprint question (once per phone), then onboarding, then the
 * app. The tabs live in (tabs)/; Settings, Insights and the walk screens are
 * pushed over them.
 */
function Gate({ fontsReady, surface }: { fontsReady: boolean; surface: string }) {
  const { repo, profile, resetAll } = useApp();
  const auth = useAuth();
  const lock = useLock();
  const access = useAccess();
  const userId = auth.userId;
  const [claimedFor, setClaimedFor] = useState<string | null>(null);
  const ready = access !== 'loading' && fontsReady;

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
      {profile.onboarded ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: surface } }} />
      ) : (
        <Onboarding />
      )}
      {access === 'locked' ? <LockScreen /> : null}
    </>
  );
}
