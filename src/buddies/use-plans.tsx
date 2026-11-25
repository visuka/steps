/**
 * Walk plans, the hooks the plan screens use (docs/walk-buddies.md 8.1
 * use-plans.ts, T16e). The API comes from BuddiesSource and the phone's
 * reminders from PlanDeviceSource, so the design preview swaps in sample data
 * and never asks for notifications; views never call the API, the repo or
 * notify.ts. The rules live in plans.ts.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { useClockStyle } from '@/hooks/use-clock-style';
import { cancelScheduled, scheduleAt } from '@/notifications/notify';
import { useApp } from '@/state/app-state';

import { canPlanForCard } from './clubs';
import { phoneTimeZone } from './steps-share';
import {
  answerAndRemind,
  cleanText,
  markTipsSeen,
  planErrorText,
  planProblem,
  type Reminders,
  syncReminders,
  tipsSeen,
  type TipsKind,
} from './plans';
import type { Plan, PlanForm, PlanPage } from './types';
import { useLoad, useSocialApi } from './use-buddies';

/** What plans need from the phone: local reminders, and whether to show the safety tips. */
export interface PlanDevice {
  reminders: Reminders;
  /** 'once': the first time (the phone); 'always' or 'never': the design preview. */
  tips: 'once' | 'always' | 'never';
}

const PHONE: PlanDevice = { reminders: { schedule: scheduleAt, cancel: cancelScheduled }, tips: 'once' };

/** The design preview: nothing scheduled, no permission asked. */
export const PREVIEW_PLAN_DEVICE: PlanDevice = {
  reminders: { schedule: async () => 'preview', cancel: async () => undefined },
  tips: 'never',
};

const Device = createContext<PlanDevice>(PHONE);

export function PlanDeviceSource({ device, children }: { device: PlanDevice; children: ReactNode }) {
  return <Device.Provider value={device}>{children}</Device.Provider>;
}

const usePlanDevice = () => useContext(Device);

/** Run an action; plain words for the snackbar on failure, or null. */
async function tryPlan(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (e) {
    return planErrorText(e);
  }
}

/** Every upcoming plan (Groups). Keeps the reminders in step, never asking for notifications. */
export function usePlans() {
  const api = useSocialApi();
  const { repo } = useApp();
  const { reminders } = usePlanDevice();
  const style = useClockStyle();
  const load = useCallback(async () => {
    const plans = await api.plans();
    void syncReminders({ kv: repo, reminders, now: Date.now(), style }, plans, { all: true }).catch(() => undefined);
    return plans;
  }, [api, repo, reminders, style]);
  return useLoad(load);
}

/** One plan: the page, my answer with its reminder, and the organiser's Cancel walk. */
export function usePlan(id: string) {
  const api = useSocialApi();
  const { repo } = useApp();
  const { reminders } = usePlanDevice();
  const style = useClockStyle();
  const [reminded, setReminded] = useState(false);

  const load = useCallback(async () => {
    const page = await api.plan(id);
    const set = await syncReminders({ kv: repo, reminders, now: Date.now(), style }, [page.plan]).catch(() => null);
    setReminded(!!set?.has(page.plan.planId));
    return page;
  }, [api, id, repo, reminders, style]);
  const page = useLoad(load);

  /** Put the new plan in the page, and my answer in my own row. */
  const put = useCallback(
    (plan: Plan) =>
      page.setData((p: PlanPage | null) =>
        p
          ? {
              plan,
              invitees: p.invitees.map((i) => (i.walker.relation === 'self' ? { ...i, answer: plan.myAnswer } : i)),
            }
          : p,
      ),
    [page],
  );

  const answer = useCallback(
    async (a: 'going' | 'not_going'): Promise<{ err: string | null; reminded: boolean }> => {
      const box = { reminded: false };
      const err = await tryPlan(async () => {
        const r = await answerAndRemind({ kv: repo, reminders, now: Date.now(), style, answerPlan: api.answerPlan }, id, a);
        box.reminded = r.reminded;
        put(r.plan);
      });
      if (!err) setReminded(box.reminded);
      return { err, reminded: box.reminded };
    },
    [api, id, repo, reminders, style, put],
  );

  const cancel = useCallback(async () => {
    const err = await tryPlan(async () => {
      const plan = await api.cancelPlan(id);
      put(plan);
      await syncReminders({ kv: repo, reminders, now: Date.now(), style }, [plan]).catch(() => undefined);
    });
    if (!err) setReminded(false);
    return err;
  }, [api, id, repo, reminders, style, put]);

  return { ...page, plan: page.data?.plan ?? null, invitees: page.data?.invitees ?? [], reminded, answer, cancel };
}

/** What the form starts from when changing a plan. */
export interface PlanBefore {
  startsAt: number;
  place: string;
  note: string;
  invite: string[];
  clubId: string | null;
}

/**
 * Plan a walk, or (with an id) change one. Loads my buddies and my clubs for
 * "Who"; returns the plan id or plain words.
 */
export function usePlanForm(id?: string, presetClub?: string | null) {
  const api = useSocialApi();
  const buddies = useLoad(api.buddies);
  const clubs = useLoad(api.myClubs);
  const loadPlan = useCallback(async () => (id ? api.plan(id) : null), [api, id]);
  const existing = useLoad(loadPlan);

  const before: PlanBefore | null = existing.data
    ? {
        startsAt: existing.data.plan.startsAt,
        place: existing.data.plan.place,
        note: existing.data.plan.note,
        invite: existing.data.invitees.filter((i) => i.walker.relation !== 'self').map((i) => i.walker.pid),
        clubId: existing.data.plan.club?.clubId ?? null,
      }
    : null;

  const save = useCallback(
    async (f: PlanForm, was: PlanBefore | null, now: number): Promise<{ planId: string | null; err: string | null }> => {
      const problem = planProblem(f, now, { editing: !!id });
      if (problem) return { planId: null, err: problem };
      const box: { planId: string | null } = { planId: null };
      const err = await tryPlan(async () => {
        if (!id) {
          box.planId = (await api.createPlan(f, phoneTimeZone())).planId;
          return;
        }
        const had = new Set(was?.invite ?? []);
        const plan = await api.updatePlan(id, {
          ...(was?.startsAt !== f.startsAt ? { startsAt: f.startsAt } : {}),
          ...(cleanText(was?.place ?? '') !== cleanText(f.place) ? { place: f.place } : {}),
          ...(cleanText(was?.note ?? '') !== cleanText(f.note) ? { note: f.note } : {}),
          invite: f.clubId ? [] : f.invite.filter((pid) => !had.has(pid)),
        });
        box.planId = plan.planId;
      });
      return { planId: box.planId, err };
    },
    [api, id],
  );

  return {
    save,
    before,
    buddies: buddies.data ?? [],
    // Club walks are planned by the captain and vice-captains only (owner, 24 Nov 2026); the
    // club a Walks tab opened the form for stays too (that tab shows Plan only to whoever may).
    clubs: (clubs.data ?? []).filter((c) => c.myState === 'member' && (canPlanForCard(c) || c.clubId === presetClub)),
    // The clubs too: ?club= can only be picked once they are in.
    loading: (!!id && existing.loading) || buddies.loading || clubs.loading,
    error: existing.error,
  };
}

/** The safety tips sheet, shown once per kind (docs/walk-buddies.md 6.4). */
export function useSafetyTips(kind: TipsKind, auto = true) {
  const { repo } = useApp();
  const { tips } = usePlanDevice();
  const [open, setOpen] = useState(tips === 'always');

  useEffect(() => {
    if (!auto || tips !== 'once') return;
    let live = true;
    tipsSeen(repo, kind)
      .then((seen) => {
        if (live && !seen) setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [auto, kind, repo, tips]);

  /** Show them now if they haven't been seen (after joining a club). */
  const showOnce = useCallback(async () => {
    if (tips === 'never') return;
    if (tips === 'always' || !(await tipsSeen(repo, kind).catch(() => true))) setOpen(true);
  }, [kind, repo, tips]);

  const close = useCallback(() => {
    setOpen(false);
    if (tips === 'once') void markTipsSeen(repo, kind).catch(() => undefined);
  }, [kind, repo, tips]);

  return { open, close, showOnce };
}

