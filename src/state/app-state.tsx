import { createContext, type ReactNode, use, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { openRepository } from '@/data/db';
import { DEFAULT_PROFILE, loadProfile, type ProfilePatch } from '@/data/profile';
import type { DaySummary, Profile, Repository, SourceId } from '@/data/types';
import { watchLiveSteps } from '@/health/live';
import { getSource, onAppStart } from '@/health/select-source';
import type { StepSource } from '@/health/types';
import { setChosenCountry } from '@/lib/country-detect';
import { addDays, dayKey, startOfDay } from '@/lib/dates';
import { addSample, type LiveSample, liveStepsSince, type Shown, stepsToShow } from '@/lib/live-steps';
import { onBackupRestored, saveProfileChange } from '@/sync/backup';
import { registerBackgroundSync, SOURCE_KEY } from '@/sync/background';
import { resetBackfill } from '@/sync/engine';
import { LAST_SYNC_KEY, runSync, syncIdle } from '@/sync/run';
import { seedPreview } from '@/sync/seed-preview';
import { syncVitals } from '@/sync/vitals-sync';
import { walkRecorder } from '@/walks/recorder';
import { refreshWeather } from '@/weather/refresh';

import { StepCounter } from '../../modules/step-counter';
import { useClock } from '@/hooks/use-clock';

export interface AppContextValue {
  repo: Repository;
  profile: Profile;
  source: StepSource;
  /** Today's synced row; null until the first sync of the day (never an earlier day's row). */
  today: DaySummary | null;
  /** Synced total plus live steps the source hasn't counted yet; never goes down during a day. */
  displaySteps: number;
  lastSyncAt: number | null;
  syncing: boolean;
  /** Bumps after every sync or data change; screens re-read when it changes. */
  dataVersion: number;
  refresh(): Promise<void>;
  /** Nested settings (reminders, water, nutrition…) merge field by field. */
  updateProfile(patch: ProfilePatch): Promise<void>;
  /** What was entered in onboarding, over the stored profile (one restored from the backup included). */
  finishOnboarding(patch: ProfilePatch, source: StepSource): Promise<void>;
  switchSource(source: StepSource): Promise<void>;
  touch(): void;
  resetAll(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Live steps the source hasn't counted yet that justify another sync (keeps the platform call rate low). */
const LIVE_SYNC_STEPS = 50;
const LIVE_SYNC_MIN_INTERVAL_MS = 60_000;

function msToNextMidnight(now = new Date()): number {
  return addDays(startOfDay(now), 1).getTime() - now.getTime() + 1_000;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [source, setSource] = useState<StepSource | null>(null);
  const [today, setToday] = useState<DaySummary | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);
  // From the clock hook, so the provider re-renders at midnight and drops yesterday's row and steps.
  const todayKey = useClock().today;

  // What the number on Today is made of; kept in refs so live events can recompute it.
  const todayRef = useRef<DaySummary | null>(null);
  const coveredUntil = useRef(startOfDay(new Date()).getTime());
  // Today's steps the source took out as riding: when it grows, the live number may come down.
  const removedToday = useRef(0);
  const samples = useRef<LiveSample[]>([]);
  const lastSyncRef = useRef(0);

  const recompute = useCallback(() => {
    const date = dayKey(new Date());
    const row = todayRef.current?.date === date ? todayRef.current : null;
    const since = Math.max(row ? coveredUntil.current : 0, startOfDay(new Date()).getTime());
    setShown((previous) =>
      stepsToShow({
        date,
        synced: row?.steps ?? 0,
        coveredUntil: since,
        samples: samples.current,
        previous,
        removed: row ? removedToday.current : 0,
      }),
    );
  }, []);

  const applyToday = useCallback(
    (row: DaySummary | null, covered?: number, removed?: number) => {
      todayRef.current = row;
      if (covered !== undefined) coveredUntil.current = covered;
      if (removed !== undefined) removedToday.current = removed;
      setToday(row && row.date === dayKey(new Date()) ? row : null);
      recompute();
    },
    [recompute],
  );

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
      // Food look-ups use the Country setting: it is set wherever the profile is, never in an effect,
      // which would run after the children's (PendingFoods may already be asking).
      setChosenCountry(p.country);
      setProfile(p);
      setSource(getSource(sourceId));
      // Until the first sync nothing says what the stored row covers, so live steps aren't added to it.
      applyToday(await r.getDay(dayKey(new Date())), synced ?? undefined);
      setLastSyncAt(synced);
      setRepo(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyToday]);

  // The cloud backup came back (src/sync/backup.ts): read the profile and today again, and every screen re-reads.
  useEffect(() => {
    if (!repo) return;
    return onBackupRestored(() => {
      (async () => {
        const p = await loadProfile(repo);
        setChosenCountry(p.country);
        setProfile(p);
        applyToday(await repo.getDay(dayKey(new Date())));
        setDataVersion((v) => v + 1);
      })().catch(() => undefined);
    });
  }, [repo, applyToday]);

  const doRefresh = useCallback(
    async (r: Repository, p: Profile, s: StepSource) => {
      setSyncing(true);
      try {
        const result = await runSync(r, p, s);
        lastSyncRef.current = Date.now();
        applyToday(result.today, result.coveredUntil, result.removedToday);
        setLastSyncAt(Date.now());
        setDataVersion((v) => v + 1);
      } catch (e) {
        console.warn('Sync failed', e);
        // Never leave an earlier day's row on screen because a sync failed.
        applyToday(await r.getDay(dayKey(new Date())).catch(() => null));
      } finally {
        setSyncing(false);
      }
      // Foreground only (MET Norway asks apps not to fetch while unused); throttled inside.
      refreshWeather(r)
        .then((updated) => updated && setDataVersion((v) => v + 1))
        .catch(() => undefined);
      // Sleep, heart rate and BP from the health store, once connected; throttled inside.
      syncVitals(r)
        .then((updated) => updated && setDataVersion((v) => v + 1))
        .catch(() => undefined);
    },
    [applyToday],
  );

  const refresh = useCallback(async () => {
    if (repo && source && profile.onboarded) await doRefresh(repo, profile, source);
  }, [repo, source, profile, doRefresh]);

  // Start-up, foreground, midnight and live-step syncs once onboarded.
  useEffect(() => {
    if (!repo || !source || !profile.onboarded) return;
    let stopped = false;
    registerBackgroundSync().catch(() => undefined);

    // Counting is (re)started before reading, so the first sync sees the counter's latest steps.
    const wake = async () => {
      await onAppStart(source).catch(() => undefined);
      if (!stopped) await doRefresh(repo, profile, source);
    };
    // Deferred so the sync's state updates land after this render commits.
    const kickoff = setTimeout(wake, 0);

    // A fresh subscription each time the app comes to the front: its first
    // event is the baseline, so steps taken in the background can't be added
    // twice. Its counts carry on from the last one, so live steps the source
    // didn't have yet stay in the number until it does.
    let stopLive: (() => void) | null = null;
    const startLive = () => {
      stopLive?.();
      const offset = samples.current.at(-1)?.count ?? 0;
      stopLive = watchLiveSteps((sample) => {
        samples.current = addSample(samples.current, { at: sample.at, count: offset + sample.count });
        recompute();
        const pending = liveStepsSince(samples.current, coveredUntil.current);
        if (pending >= LIVE_SYNC_STEPS && Date.now() - lastSyncRef.current > LIVE_SYNC_MIN_INTERVAL_MS) {
          lastSyncRef.current = Date.now();
          doRefresh(repo, profile, source);
        }
      });
    };
    startLive();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startLive();
        recompute();
        wake();
      } else if (state === 'background') {
        stopLive?.();
        stopLive = null;
      }
    });

    // At midnight the number starts again from zero and the new day is read.
    let midnight: ReturnType<typeof setTimeout>;
    const armMidnight = () => {
      midnight = setTimeout(() => {
        samples.current = [];
        recompute();
        doRefresh(repo, profile, source);
        armMidnight();
      }, msToNextMidnight());
    };
    armMidnight();

    return () => {
      stopped = true;
      clearTimeout(kickoff);
      clearTimeout(midnight);
      appState.remove();
      stopLive?.();
    };
  }, [repo, source, profile, doRefresh, recompute]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!repo) return;
      // Over the profile as stored (a restore may have just brought it back), kept for the restore if one is due.
      const next = await saveProfileChange(repo, patch);
      setChosenCountry(next.country);
      setProfile(next);
    },
    [repo],
  );

  const finishOnboarding = useCallback(
    async (patch: ProfilePatch, s: StepSource) => {
      if (!repo) return;
      await repo.setKv(SOURCE_KEY, s.id);
      // Only what was entered in onboarding, over the stored profile: never a default over a restored answer.
      const next = await saveProfileChange(repo, patch, { onboarded: true });
      setSource(s);
      setChosenCountry(next.country);
      setProfile(next);
    },
    [repo],
  );

  const switchSource = useCallback(
    async (s: StepSource) => {
      if (!repo) return;
      if (!(await s.requestPermissions())) return;
      // A sync still reading the old source could otherwise mark history as filled from it.
      await syncIdle();
      await repo.setKv(SOURCE_KEY, s.id);
      await resetBackfill(repo);
      // The phone's counter would keep showing its own number in the notification.
      if (source?.id === 'device-sensor' && s.id !== 'device-sensor') await StepCounter?.stop();
      setShown(null);
      setSource(s);
    },
    [repo, source],
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
    samples.current = [];
    setShown(null);
    applyToday(null, startOfDay(new Date()).getTime());
    setLastSyncAt(null);
    setChosenCountry(DEFAULT_PROFILE.country);
    setProfile(DEFAULT_PROFILE);
    setDataVersion((v) => v + 1);
  }, [repo, applyToday]);

  const touch = useCallback(() => setDataVersion((v) => v + 1), []);

  if (!repo || !source) return null;

  const value: AppContextValue = {
    repo,
    profile,
    source,
    // Checked at every render: after midnight the row in memory can be yesterday's until the next sync.
    today: today?.date === todayKey ? today : null,
    displaySteps:
      shown?.date === todayKey ? shown.steps : today?.date === todayKey ? today.steps : 0,
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

/**
 * The design preview only (app/design-preview.tsx): the screens over a fixed
 * value made of sample data (design-preview/providers.tsx), in place of
 * AppProvider, so nothing on the phone is read, synced or written.
 */
export function PreviewAppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
