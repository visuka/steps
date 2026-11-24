/**
 * Shared club goals, the hooks the goal screens use. The API comes from
 * BuddiesSource (use-buddies.tsx), so the design preview swaps in sample
 * data; views never call the API or the repo. Rules and words live in
 * goals.ts, the phone's own counting in goals-auto.ts.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { previewLaunch } from '@/design-preview/launch';
import { useClock } from '@/hooks/use-clock';
import { premiumOpenOnPhone } from '@/premium/premium';
import { useApp } from '@/state/app-state';

import { isStaff } from './clubs';
import { applyMarks, autoMarks, type PhoneToday, readPhoneToday, runGoalsAuto } from './goals-auto';
import { goalErrorText, goalsDigest, remindTargets, trackedCount } from './goals';
import type { GoalPatch } from './goals-api';
import { notifyOf } from './read';
import type { Club, ClubCard, ClubGoals, Goal, GoalForm, GoalSummaryRow, SocialMe } from './types';
import { ME_KEY, useLoad, useSocialApi, useSocialMe } from './use-buddies';

/** Run an action; returns plain words for the snackbar on failure, or null. */
async function tryGoal(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (e) {
    return goalErrorText(e);
  }
}

/** Today's own numbers on the phone (steps on screen, water, sleep, the longest walk). */
export function usePhoneToday(): PhoneToday | null {
  const { repo, profile, displaySteps, dataVersion } = useApp();
  const today = useClock().today;
  const [phone, setPhone] = useState<PhoneToday | null>(null);
  useEffect(() => {
    let live = true;
    readPhoneToday(repo, profile, today, displaySteps)
      .then((p) => live && setPhone(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [repo, profile, today, displaySteps, dataVersion]);
  return phone;
}

export interface ClubGoalsView extends ClubGoals {
  summary: GoalSummaryRow[];
}

/**
 * One club's goals for today: the goals, my marks, and (captain and
 * vice-captains) how many are done. Goals the phone counts are marked
 * right after loading, so what the tab shows matches what was sent.
 */
export function useClubGoals(club: Pick<Club, 'clubId' | 'myRole' | 'goals'>) {
  const api = useSocialApi();
  const { repo, profile, displaySteps } = useApp();
  const today = useClock().today;
  const staff = isStaff(club.myRole);
  const id = club.clubId;
  const load = useCallback(async (): Promise<ClubGoalsView> => {
    const [cg, summary] = await Promise.all([
      api.clubGoals(id, today),
      staff ? api.goalSummary(id, today).catch(() => [] as GoalSummaryRow[]) : Promise.resolve([] as GoalSummaryRow[]),
    ]);
    if (!cg.tracked || !cg.goals.some((g) => g.counted === 'auto')) return { ...cg, summary };
    const phone = await readPhoneToday(repo, profile, today, displaySteps).catch(() => null);
    if (!phone) return { ...cg, summary };
    const sent: { goalId: string; done: boolean; value?: number; at?: number | null }[] = [];
    for (const m of autoMarks(cg, phone, today)) {
      try {
        const r = await api.putMark(id, m.goalId, today, m.value === undefined ? { done: m.done } : { done: m.done, value: m.value });
        sent.push({ ...m, at: r.at });
      } catch {
        // shown as it was; the next look tries again
      }
    }
    return { ...cg, mine: applyMarks(cg.mine, sent), summary };
  }, [api, id, today, staff, repo, profile, displaySteps]);
  const state = useLoad(load);
  const phone = usePhoneToday();
  const [busy, setBusy] = useState<string | null>(null);
  const { setData } = state;

  /** A tap goal: done now, or undo. */
  const mark = useCallback(
    async (goalId: string, done: boolean): Promise<string | null> => {
      setBusy(goalId);
      try {
        return await tryGoal(async () => {
          const r = await api.putMark(id, goalId, today, { done });
          setData((cur) => (cur ? { ...cur, mine: applyMarks(cur.mine, [{ goalId, done: r.done, at: r.at }]) } : cur));
        });
      } finally {
        setBusy(null);
      }
    },
    [api, id, today, setData],
  );

  /** Yes or no to goal tracking in this club. */
  const setConsent = useCallback(
    async (on: boolean): Promise<string | null> => {
      setBusy('consent');
      try {
        const err = await tryGoal(() => api.setGoalsConsent(id, on));
        if (!err) await state.refresh();
        return err;
      } finally {
        setBusy(null);
      }
    },
    [api, id, state],
  );

  return { ...state, phone, today, staff, busy, mark, setConsent };
}

/** One goal for the captain: who did it today and this week, a gentle reminder, pause and delete. */
export function useGoalReport(id: string, goalId: string) {
  const api = useSocialApi();
  const today = useClock().today;
  const { me } = useSocialMe();
  const load = useCallback(() => api.goalReport(id, goalId, today), [api, id, goalId, today]);
  const state = useLoad(load);
  const [busy, setBusy] = useState(false);
  const [reminded, setReminded] = useState(false);
  const myPid = me?.joined ? me.pid : null;
  const report = state.data;
  const targets = useMemo(() => (report ? remindTargets(report, myPid) : []), [report, myPid]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      return await tryGoal(action);
    } finally {
      setBusy(false);
    }
  }, []);

  const remind = useCallback(async () => {
    const err = await run(() => api.remindGoal(id, goalId, targets));
    if (!err) setReminded(true);
    return err;
  }, [run, api, id, goalId, targets]);

  const { setData } = state;
  const setPaused = useCallback(
    (paused: boolean) =>
      run(async () => {
        const goal = await api.updateGoal(id, goalId, { paused });
        setData((cur) => (cur ? { ...cur, goal } : cur));
      }),
    [run, api, id, goalId, setData],
  );

  const remove = useCallback(() => run(() => api.deleteGoal(id, goalId)), [run, api, id, goalId]);

  return { ...state, today, busy, reminded, targets, remind, setPaused, remove };
}

/** The goal form: a saved goal to change (or null for a new one), and save. */
export function useGoalForm(id: string, goalId: string | null) {
  const api = useSocialApi();
  const today = useClock().today;
  const load = useCallback(async (): Promise<Goal | null> => {
    if (!goalId) return null;
    const cg = await api.clubGoals(id, today);
    const g = cg.goals.find((x) => x.goalId === goalId);
    if (!g) throw new Error('gone');
    return g;
  }, [api, id, goalId, today]);
  const state = useLoad(load);
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async (f: GoalForm): Promise<string | null> => {
      setBusy(true);
      try {
        return await tryGoal(async () => {
          if (!goalId) {
            await api.createGoal(id, f);
            return;
          }
          const patch: GoalPatch = { title: f.title, byTime: f.byTime, days: f.days };
          // The server keeps kind and counted as made; an auto goal always keeps a target.
          if (f.target !== null || state.data?.counted !== 'auto') patch.target = f.target;
          await api.updateGoal(id, goalId, patch);
        });
      } finally {
        setBusy(false);
      }
    },
    [api, id, goalId, state.data],
  );

  return { ...state, busy, save };
}

export interface MyClubGoals {
  club: ClubCard;
  goals: ClubGoals | null;
  error: boolean;
}

/** My goals across every club I am in that has goals, and the goal reminders switch. */
export function useMyGoals() {
  const api = useSocialApi();
  const today = useClock().today;
  const social = useSocialMe();
  const load = useCallback(async (): Promise<MyClubGoals[]> => {
    const cards = (await api.myClubs()).filter((c) => c.goals && c.myState === 'member');
    return Promise.all(
      cards.map(async (club) => {
        try {
          return { club, goals: await api.clubGoals(club.clubId, today), error: false };
        } catch {
          return { club, goals: null, error: true };
        }
      }),
    );
  }, [api, today]);
  const state = useLoad(load);
  const phone = usePhoneToday();
  const [busy, setBusy] = useState<string | null>(null);
  const { setData } = state;
  const { me, setMe } = social;
  const reminders = notifyOf(me).goals;

  const mark = useCallback(
    async (clubId: string, goalId: string, done: boolean): Promise<string | null> => {
      setBusy(`${clubId}/${goalId}`);
      try {
        return await tryGoal(async () => {
          const r = await api.putMark(clubId, goalId, today, { done });
          setData((cur) =>
            cur
              ? cur.map((x) =>
                  x.club.clubId === clubId && x.goals
                    ? { ...x, goals: { ...x.goals, mine: applyMarks(x.goals.mine, [{ goalId, done: r.done, at: r.at }]) } }
                    : x,
                )
              : cur,
          );
        });
      } finally {
        setBusy(null);
      }
    },
    [api, today, setData],
  );

  const setReminders = useCallback(
    async (on: boolean): Promise<string | null> => {
      setBusy('notify');
      try {
        return await tryGoal(async () => {
          const next: SocialMe = await api.updateMe({ notify: { goals: on } });
          setMe(next);
        });
      } finally {
        setBusy(null);
      }
    },
    [api, setMe],
  );

  const setConsent = useCallback(
    async (clubId: string, on: boolean): Promise<string | null> => {
      setBusy(`consent/${clubId}`);
      try {
        const err = await tryGoal(() => api.setGoalsConsent(clubId, on));
        if (!err) await state.refresh();
        return err;
      } finally {
        setBusy(null);
      }
    },
    [api, state],
  );

  return { ...state, phone, today, busy, reminders, remindersKnown: !!me?.joined, mark, setReminders, setConsent };
}

/**
 * Marks the goals the phone counts, when Buddies or Today opens and while
 * it stays open (at most every 15 minutes; goals-auto.ts). Never in the
 * design preview, only after joining Walk buddies, and only with premium.
 */
export function useGoalsAuto() {
  const api = useSocialApi();
  const { repo, profile, displaySteps } = useApp();
  const today = useClock().today;
  const steps = useRef(displaySteps);
  useEffect(() => {
    steps.current = displaySteps;
  }, [displaySteps]);
  useFocusEffect(
    useCallback(() => {
      if (previewLaunch() !== null) return undefined;
      let live = true;
      const tick = async () => {
        if (!live || AppState.currentState !== 'active') return;
        const me = await repo.getKv<SocialMe>(ME_KEY).catch(() => null);
        if (!me?.joined || !(await premiumOpenOnPhone(repo))) return;
        await runGoalsAuto({
          kv: repo,
          api,
          phone: () => readPhoneToday(repo, profile, today, steps.current),
          today,
          now: Date.now(),
        });
      };
      void tick().catch(() => undefined);
      const timer = setInterval(() => void tick().catch(() => undefined), 5 * 60_000);
      return () => {
        live = false;
        clearInterval(timer);
      };
    }, [api, repo, profile, today]),
  );
}

/**
 * Buddies home: today's goals done across my clubs (from the clubs already loaded), each
 * club's goals for its row's goal line, and how many clubs count my goals (the My goals
 * tile shows only then). `refresh` reads them again (pull to refresh).
 */
export function useGoalsDigest(cards: Pick<ClubCard, 'clubId' | 'goals' | 'myState'>[] | null) {
  const api = useSocialApi();
  const today = useClock().today;
  const ids = (cards ?? []).filter((c) => c.goals && c.myState === 'member').map((c) => c.clubId);
  const key = ids.join(',');
  const [read, setRead] = useState<{ key: string; byClub: Record<string, ClubGoals | null> } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const list = key.split(',');
    Promise.all(list.map((id) => api.clubGoals(id, today).then((goals) => goals, () => null)))
      .then((got) => {
        if (!live) return;
        const byClub: Record<string, ClubGoals | null> = {};
        list.forEach((id, i) => (byClub[id] = got[i]));
        setRead({ key, byClub });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [api, key, today, round]);
  const byClub = read && read.key === key ? read.byClub : null;
  const list = byClub ? Object.values(byClub).map((goals) => ({ goals })) : null;
  const refresh = useCallback(() => setRound((r) => r + 1), []);
  return {
    clubs: ids.length,
    digest: key && list ? goalsDigest(list, today) : null,
    /** Each goals club's goals for today; null while loading, a club's null when it could not be read. */
    byClub: key ? byClub : {},
    tracked: list ? trackedCount(list) : 0,
    today,
    refresh,
  };
}
