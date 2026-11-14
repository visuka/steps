import { type ReactNode, useCallback, useState } from 'react';

import { PreviewAuthProvider } from '@/auth/auth-state';
import { memoryRepository } from '@/data/db.web';
import { mergeProfile, type ProfilePatch } from '@/data/profile';
import type { StepSource } from '@/health/types';
import { type AppContextValue, PreviewAppProvider } from '@/state/app-state';
import { PreviewPremiumProvider } from '@/state/use-premium';

import { SAMPLE_NOW, SAMPLE_PROFILE, SAMPLE_STEPS, SAMPLE_TODAY, sampleSnapshot, sampleStepBuckets } from './sample';

/** A step source holding only the sample day's minutes (the detail screen's 15-minute bars and active minutes); the day's totals are already in the repository. */
const SAMPLE_SOURCE: StepSource = {
  id: 'demo',
  label: 'Sample day',
  isAvailable: async () => true,
  requestPermissions: async () => true,
  getStepBuckets: async (start, end, bucketMinutes) => sampleStepBuckets(start, end, bucketMinutes),
  getDistanceM: async () => null,
  getFloors: async () => null,
  getDailyTotals: async () => [],
};

/**
 * The providers the screens read, over the sample day only: useApp() gets a
 * memory repository seeded with design-preview/sample.ts, useAuth() nobody,
 * usePremium() every feature open. Nothing touches the phone's database,
 * session, health data or notifications; changes made on screen (a glass of
 * water, a removed part) live in memory until the app closes.
 *
 * This is the injection seam for the screens: a screen that reads its data
 * through useApp() (repo, profile, today, displaySteps…) and the hooks built
 * on it (useCaloriesToday, useWaterToday, useMoodToday…) shows the sample day
 * here with no change. Data a screen gets elsewhere must come in by props.
 */
export function SampleDataProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(() => memoryRepository(sampleSnapshot()));
  const [profile, setProfile] = useState(SAMPLE_PROFILE);
  const [dataVersion, setDataVersion] = useState(0);
  const touch = useCallback(() => setDataVersion((v) => v + 1), []);

  const value: AppContextValue = {
    repo,
    profile,
    source: SAMPLE_SOURCE,
    today: SAMPLE_TODAY,
    displaySteps: SAMPLE_STEPS,
    lastSyncAt: SAMPLE_NOW - 2 * 60_000,
    syncing: false,
    dataVersion,
    refresh: async () => undefined,
    updateProfile: async (patch: ProfilePatch) => setProfile((p) => mergeProfile(p, patch)),
    finishOnboarding: async () => undefined,
    switchSource: async () => undefined,
    touch,
    resetAll: async () => undefined,
  };

  return (
    <PreviewAuthProvider>
      <PreviewAppProvider value={value}>
        <PreviewPremiumProvider>{children}</PreviewPremiumProvider>
      </PreviewAppProvider>
    </PreviewAuthProvider>
  );
}
