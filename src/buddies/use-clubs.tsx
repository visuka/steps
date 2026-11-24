/**
 * Walk buddies clubs, the hooks the club screens use (docs/walk-buddies.md
 * 8.1 use-clubs.ts, 8.3). The API comes from BuddiesSource (use-buddies.tsx),
 * so the design preview swaps in sample data; views never call the API or
 * the repo. Multi-step rules live in clubs.ts and steps-share.ts.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useClock } from '@/hooks/use-clock';
import { useApp } from '@/state/app-state';

import { clubErrorText, isConsentError, joinOrAccept, searchReady } from './clubs';
import { rememberBoard, sendSteps } from './steps-share';
import type { ClubCard, ClubForm, ReportReason } from './types';
import { useLoad, useSocialApi, useSocialMe } from './use-buddies';

type JoinState = Awaited<ReturnType<typeof joinOrAccept>>;

/** Run an action; returns plain words for the snackbar on failure, or null. */
async function tryClub(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (e) {
    return clubErrorText(e);
  }
}

/** The clubs I am in (Buddies home, Groups). */
export function useMyClubs() {
  const api = useSocialApi();
  return useLoad(api.myClubs);
}

/**
 * My clubs while Buddies is locked (premium ended): GET /clubs/mine stays free, and so
 * do leaving a club and stopping goal tracking (server handler.py), so a member can
 * always take back their goals consent. Nothing is read before joining Walk buddies.
 */
export function useLockedClubs() {
  const api = useSocialApi();
  const { repo } = useApp();
  const { me } = useSocialMe();
  const joined = !!me?.joined;
  const load = useCallback(async () => (joined ? api.myClubs() : ([] as ClubCard[])), [api, joined]);
  const state = useLoad(load);
  const { refresh } = state;
  const [busy, setBusy] = useState<string | null>(null);
  // The saved walker is read after the first look: look again once it says joined.
  useEffect(() => {
    if (joined) void refresh();
  }, [joined, refresh]);

  const leave = useCallback(
    async (id: string): Promise<string | null> => {
      setBusy(`leave/${id}`);
      try {
        const err = await tryClub(() => api.leaveClub(id));
        if (!err) {
          await rememberBoard(repo, id, false).catch(() => undefined);
          await refresh();
        }
        return err;
      } finally {
        setBusy(null);
      }
    },
    [api, repo, refresh],
  );

  const stopTracking = useCallback(
    async (id: string): Promise<string | null> => {
      setBusy(`goals/${id}`);
      try {
        return await tryClub(() => api.setGoalsConsent(id, false));
      } finally {
        setBusy(null);
      }
    },
    [api],
  );

  return { clubs: state.data, error: state.error, busy, leave, stopTracking };
}

/** Club search: a query, the cards found, and whether a search has run. */
export function useClubSearch() {
  const api = useSocialApi();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<ClubCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!searchReady(q)) {
      setError('Type at least 2 letters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setFound(await api.searchClubs(q));
    } catch (e) {
      setError(clubErrorText(e));
    } finally {
      setBusy(false);
    }
  }, [api, q]);

  /** After joining from the list: show the new state without searching again. */
  const update = useCallback((clubId: string, myState: ClubCard['myState']) => {
    setFound((list) => (list ? list.map((c) => (c.clubId === clubId ? { ...c, myState } : c)) : list));
  }, []);

  return { q, setQ, found, busy, error, search, update };
}

/** One club: the page (club and members), and what a member or a visitor can do. */
export function useClub(id: string) {
  const api = useSocialApi();
  const { repo } = useApp();
  const load = useCallback(async () => {
    const page = await api.club(id);
    // Keep the phone's list of boards I am on in step with the server (steps-share.ts).
    void rememberBoard(repo, id, page.club.myState === 'member' && page.club.myBoard).catch(() => undefined);
    return page;
  }, [api, id, repo]);
  const page = useLoad(load);
  const club = page.data?.club ?? null;

  /**
   * Ask to join or accept an invite; a club with goals sends nothing until `consent`.
   * When the captain turned goals on after the last load (409 goals_consent), the
   * page is read again and the state is 'needs_consent', so the caller opens the consent.
   */
  const join = useCallback(
    async (o: { consent?: boolean; code?: string } = {}): Promise<{ err: string | null; state: JoinState | null }> => {
      if (!club) return { err: null, state: null };
      let state: JoinState;
      try {
        state = await joinOrAccept(api, club, o);
      } catch (e) {
        if (isConsentError(e)) {
          await page.refresh();
          return { err: null, state: 'needs_consent' };
        }
        return { err: clubErrorText(e), state: null };
      }
      if (state !== 'needs_consent') await page.refresh();
      return { err: null, state };
    },
    [api, club, page],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      const err = await tryClub(action);
      if (!err) await page.refresh();
      return err;
    },
    [page],
  );

  const setBoard = useCallback(
    async (on: boolean) => {
      const err = await tryClub(() => api.setBoard(id, on));
      if (!err) {
        await rememberBoard(repo, id, on).catch(() => undefined);
        page.setData((p) => (p ? { ...p, club: { ...p.club, myBoard: on } } : p));
      }
      return err;
    },
    [api, id, repo, page],
  );

  return {
    ...page,
    club,
    members: page.data?.members ?? [],
    join,
    cancelJoin: () => run(() => api.cancelJoin(id)),
    declineInvite: () => run(() => api.declineClubInvite(id)),
    leave: async () => {
      const err = await tryClub(() => api.leaveClub(id));
      if (!err) await rememberBoard(repo, id, false).catch(() => undefined);
      return err;
    },
    remove: () => tryClub(() => api.deleteClub(id)),
    setBoard,
    report: (reason: ReportReason, note: string) =>
      tryClub(() => api.report({ kind: 'club', ref: id, reason, note: note || undefined })),
  };
}

/** The weekly board of a club I am in. */
export function useBoard(id: string) {
  const api = useSocialApi();
  const load = useCallback(() => api.board(id), [api, id]);
  return useLoad(load);
}

/** The captain's and vice-captains' page: join requests, members, reports, inviting buddies. */
export function useClubAdmin(id: string) {
  const api = useSocialApi();
  const page = useLoad(useCallback(() => api.club(id), [api, id]));
  const requests = useLoad(useCallback(() => api.clubRequests(id), [api, id]));
  const reports = useLoad(useCallback(() => api.clubReports(id), [api, id]));
  const buddies = useLoad(api.buddies);

  const refresh = useCallback(async () => {
    await Promise.all([page.refresh(), requests.refresh(), reports.refresh(), buddies.refresh()]);
  }, [page, requests, reports, buddies]);

  const act = useCallback(
    async (action: () => Promise<unknown>) => {
      const err = await tryClub(action);
      await refresh();
      return err;
    },
    [refresh],
  );

  return {
    club: page.data?.club ?? null,
    members: page.data?.members ?? [],
    requests: requests.data ?? [],
    reports: reports.data ?? [],
    buddies: buddies.data ?? [],
    error: page.error,
    loading: page.loading,
    refresh,
    approve: (pid: string) => act(() => api.approveRequest(id, pid)),
    decline: (pid: string) => act(() => api.declineRequest(id, pid)),
    invite: (pid: string) => act(() => api.inviteBuddy(id, pid)),
    setRole: (pid: string, role: 'admin' | 'member') => act(() => api.setRole(id, pid, role)),
    removeMember: (pid: string) => act(() => api.removeMember(id, pid)),
    closeReport: (reportId: string, action: 'dismiss' | 'removed') => act(() => api.closeClubReport(id, reportId, action)),
  };
}

/** Start a club, or change one (captain or vice-captain). Returns the club id, or an error. */
export function useClubForm(id?: string) {
  const api = useSocialApi();
  const save = useCallback(
    async (f: ClubForm, before?: ClubForm): Promise<{ clubId: string | null; err: string | null }> => {
      const box: { clubId: string | null } = { clubId: null };
      const err = await tryClub(async () => {
        if (!id) {
          box.clubId = (await api.createClub(f)).clubId;
          return;
        }
        const patch: Partial<ClubForm> = {};
        for (const k of ['name', 'area', 'about', 'hidden', 'goals'] as const) {
          if (!before || before[k] !== f[k]) (patch as Record<string, unknown>)[k] = f[k];
        }
        box.clubId = (await api.updateClub(id, patch)).clubId;
      });
      return { clubId: box.clubId, err };
    },
    [api, id],
  );
  const load = useCallback(async () => (id ? (await api.club(id)).club : null), [api, id]);
  const existing = useLoad(load);
  return { save, existing: existing.data, loading: !!id && existing.loading };
}

/**
 * Sends today's and this week's steps for the club boards while the screen
 * is in front: on focus, then every 5 minutes it checks (sending at most
 * every 30 minutes, steps-share.ts). Nothing is sent when no board is on.
 */
export function useStepsShare() {
  const api = useSocialApi();
  const { repo } = useApp();
  const today = useClock().today;
  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        if (AppState.currentState !== 'active') return;
        void sendSteps({ repo, putSteps: api.putSteps, today, now: Date.now() }).catch(() => undefined);
      };
      tick();
      const timer = setInterval(tick, 5 * 60_000);
      return () => clearInterval(timer);
    }, [api, repo, today]),
  );
}
