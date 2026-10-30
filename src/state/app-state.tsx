import { createContext, type ReactNode, use, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { openRepository } from '@/data/db';
import { DEFAULT_PROFILE, loadProfile, saveProfile } from '@/data/profile';
import type { DaySummary, Profile, Repository, SourceId } from '@/data/types';
import { watchLiveSteps } from '@/health/live';
import { getSource, onAppStart } from '@/health/select-source';
import type { StepSource } from '@/health/types';
import { dayKey } from '@/lib/dates';
import { registerBackgroundSync, SOURCE_KEY } from '@/sync/background';
import { resetBackfill } from '@/sync/engine';
import { LAST_SYNC_KEY, runSync } from '@/sync/run';
import { seedPreview } from '@/sync/seed-preview';
import { walkRecorder } from '@/walks/recorder';
import { refreshWeather } from '@/weather/refresh';

import { StepCounter } from '../../modules/step-counter';

interface AppContextValue {
  repo: Repository;
  profile: Profile;
  source: StepSource;
  today: DaySummary | null;
  /** Synced total plus live steps taken since the last sync. */
  displaySteps: number;
  lastSyncAt: number | null;
  syncing: boolean;
  /** Bumps after every sync or data change; screens re-read when it changes. */
  dataVersion: number;
  refresh(): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  finishOnboarding(profile: Profile, source: StepSource): Promise<void>;
  switchSource(source: StepSource): Promise<void>;
  touch(): void;
  resetAll(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Live steps since the last sync that justify another sync (keeps the platform call rate low). */
const LIVE_SYNC_STEPS = 50;
const LIVE_SYNC_MIN_INTERVAL_MS = 20_000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [source, setSource] = useState<StepSource | null>(null);
  const [today, setToday] = useState<DaySummary | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [liveExtra, setLiveExtra] = useState(0);

  const liveCount = useRef(0);
  const liveAtSync = useRef(0);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await openRepository();
      await seedPreview(r);
      const [p, sourceId, synced] = await Promise.all([
        loadProfile(r),
        r.getKv<SourceId>(SOURCE_KEY),
        r.getKv<number>(LAST_SYNC_KEY),
      ]);
      if (cancelled) return;
      setProfile(p);
      setSource(getSource(sourceId));
      setToday(await r.getDay(dayKey(new Date())));
      setLastSyncAt(synced);
      setRepo(r);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doRefresh = useCallback(
    async (r: Repository, p: Profile, s: StepSource) => {
      setSyncing(true);
      try {
        const result = await runSync(r, p, s);
        liveAtSync.current = liveCount.current;
        lastSyncRef.current = Date.now();
        setLiveExtra(0);
        setToday(result.today);
        setLastSyncAt(Date.now());
        setDataVersion((v) => v + 1);
      } catch (e) {
        console.warn('Sync failed', e);
      } finally {
        setSyncing(false);
      }
      // Foreground only (MET Norway asks apps not to fetch while unused); throttled inside.
      refreshWeather(r)
        .then((updated) => updated && setDataVersion((v) => v + 1))
        .catch(() => undefined);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (repo && source && profile.onboarded) await doRefresh(repo, profile, source);
  }, [repo, source, profile, doRefresh]);

  // Start-up, foreground and live-step syncs once onboarded.
  useEffect(() => {
    if (!repo || !source || !profile.onboarded) return;
    onAppStart(source);
    registerBackgroundSync().catch(() => undefined);
    // Deferred so the sync's state updates land after this render commits.
    const kickoff = setTimeout(() => doRefresh(repo, profile, source), 0);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') doRefresh(repo, profile, source);
    });
    // A new subscription counts from zero, so the baseline must too.
    liveCount.current = 0;
    liveAtSync.current = 0;
    const stopLive = watchLiveSteps((count) => {
      liveCount.current = count;
      const extra = count - liveAtSync.current;
      setLiveExtra(Math.max(0, extra));
      if (extra >= LIVE_SYNC_STEPS && Date.now() - lastSyncRef.current > LIVE_SYNC_MIN_INTERVAL_MS) {
        doRefresh(repo, profile, source);
      }
    });
    return () => {
      clearTimeout(kickoff);
      appState.remove();
      stopLive();
    };
  }, [repo, source, profile, doRefresh]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!repo) return;
      const next = { ...profile, ...patch, reminders: { ...profile.reminders, ...patch.reminders } };
      await saveProfile(repo, next);
      setProfile(next);
    },
    [repo, profile],
  );

  const finishOnboarding = useCallback(
    async (p: Profile, s: StepSource) => {
      if (!repo) return;
      const next = { ...p, onboarded: true };
      await repo.setKv(SOURCE_KEY, s.id);
      await saveProfile(repo, next);
      setSource(s);
      setProfile(next);
    },
    [repo],
  );

  const switchSource = useCallback(
    async (s: StepSource) => {
      if (!repo) return;
      await s.requestPermissions();
      await repo.setKv(SOURCE_KEY, s.id);
      await resetBackfill(repo);
      setSource(s);
    },
    [repo],
  );

  const resetAll = useCallback(async () => {
    if (!repo) return;
    const walking = await walkRecorder.active();
    if (walking) {
      await walkRecorder.stop();
      await walkRecorder.discard(walking);
    }
    await repo.clearAll();
    await StepCounter?.stop();
    await StepCounter?.clear();
    setToday(null);
    setLastSyncAt(null);
    setProfile(DEFAULT_PROFILE);
    setDataVersion((v) => v + 1);
  }, [repo]);

  const touch = useCallback(() => setDataVersion((v) => v + 1), []);

  if (!repo || !source) return null;

  const value: AppContextValue = {
    repo,
    profile,
    source,
    today,
    displaySteps: (today?.steps ?? 0) + liveExtra,
    lastSyncAt,
    syncing,
    dataVersion,
    refresh,
    updateProfile,
    finishOnboarding,
    switchSource,
    touch,
    resetAll,
  };
  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
