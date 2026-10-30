import '@/sync/background';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Onboarding } from '@/components/onboarding';
import { AppProvider, useApp } from '@/state/app-state';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <Gate />
      </AppProvider>
    </ThemeProvider>
  );
}

/**
 * Rendered once the database and profile have loaded. The tabs live in
 * (tabs)/; Settings and the walk screens are pushed over them.
 */
function Gate() {
  const { profile } = useApp();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return profile.onboarded ? <Stack screenOptions={{ headerShown: false }} /> : <Onboarding />;
}
