import '@/sync/background';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, type Theme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

import { AuthProvider, useAccess, useAuth } from '@/auth/auth-state';
import { claimLocalData } from '@/auth/owner';
import { carriedOverAccount } from '@/auth/session-storage';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ConfirmHost } from '@/components/confirm-host';
import { LockOffer, LockScreen } from '@/components/auth/lock-screen';
import { Onboarding } from '@/components/onboarding';
import { ActiveTheme, Colors, Fonts, ThemeMode } from '@/constants/theme';
import { loadPreviewFonts } from '@/constants/themes/apply';
import { fontMap } from '@/constants/themes/build';
import { CLEAN_FONT_FILES } from '@/constants/themes/fonts';
import { installPreviewClock } from '@/design-preview/clock';
import { previewLaunch } from '@/design-preview/launch';
import { SampleDataProvider } from '@/design-preview/providers';
import { SAMPLE_NOW } from '@/design-preview/sample';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LockProvider, useLock } from '@/state/app-lock';
import { AppProvider, useApp } from '@/state/app-state';
import { usePendingFoods } from '@/state/use-pending-foods';
import { PremiumProvider, usePremium } from '@/state/use-premium';

SplashScreen.preventAutoHideAsync();

/**
 * Native parts (the date and time pickers, alerts) take the theme's own scheme, never the
 * phone's: Night's stay dark, the light looks' stay light. A theme change restarts the app,
 * so setting it once per run is enough.
 */
Appearance.setColorScheme(ThemeMode);

/** Started by the design preview's link: sample day, sample clock, the link's theme (design-preview/launch.ts). */
const PREVIEW = previewLaunch() !== null;
if (PREVIEW) installPreviewClock(SAMPLE_NOW);

/** The active theme's faces, plus the Clean+ faces (Poppins and Telugu); the splash waits for these. */
const FONTS = { ...fontMap(ActiveTheme), ...CLEAN_FONT_FILES };

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

  if (PREVIEW) {
    return (
      <ThemeProvider value={navigationTheme(dark)}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <PreviewGate fontsReady={fontsReady} surface={surface} />
        <ConfirmHost />
      </ThemeProvider>
    );
  }

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
 * A run started by the design preview's link (app/design-preview.tsx): no
 * sign-in, lock or onboarding, and every screen over the sample day only, so
 * nothing on the phone is read or written. Never in a normal run.
 */
function PreviewGate({ fontsReady, surface }: { fontsReady: boolean; surface: string }) {
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);
  if (!fontsReady) return null;
  return (
    <SampleDataProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: surface } }} />
    </SampleDataProvider>
  );
}

/**
 * Foods whose values are still coming (an ingredient the server is finding)
 * are looked up again quietly on app opens: signed in, with food look-ups.
 */
function PendingFoods({ signedIn }: { signedIn: boolean }) {
  const { repo, source, touch } = useApp();
  const premium = usePremium();
  usePendingFoods(repo, source, signedIn && !premium.isLocked('food'), touch);
  return null;
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
    if (!ready) return;
    SplashScreen.hideAsync();
    // The other themes' faces, for the Appearance picker's previews; never in the way of start-up.
    loadPreviewFonts();
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
        <>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: surface } }} />
          <PendingFoods signedIn={Boolean(userId)} />
        </>
      ) : (
        <Onboarding />
      )}
      {access === 'locked' ? <LockScreen /> : null}
    </>
  );
}
