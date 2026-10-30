import '@/sync/background';

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
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

/** Rendered once the database and profile have loaded. */
function Gate() {
  const { profile } = useApp();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return profile.onboarded ? <AppTabs /> : <Onboarding />;
}
