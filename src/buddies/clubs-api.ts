/**
 * Calls to the club routes (/v1/social/clubs*, docs/walk-buddies.md 2.5
 * "Clubs" plus the goals and club-code contract). Built over one `send`
 * function so tests can check every method, path and body without the
 * network; api.ts gives it the real `call`. Views never import this.
 */
import {
  readBoard,
  readClubCard,
  readClubCode,
  readClubPage,
  readClubReply,
  readClubReports,
  readClubRequests,
  readClubs,
  readJoinState,
} from './clubs-read';
import { cleanClubCode } from './qr/links';
import { isObj } from './read';
import type { Board, Club, ClubCard, ClubCode, ClubForm, ClubPage, ClubReport, ClubRole, RequestRow } from './types';

export type Send = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<unknown>;

/** What a join sends: the goals consent for a club with goals, and a code from a QR invite. */
export interface JoinOptions {
  goalsConsent?: boolean;
  code?: string;
}

const enc = encodeURIComponent;

function joinBody(o: JoinOptions): Record<string, unknown> | undefined {
  const body: Record<string, unknown> = {};
  if (o.goalsConsent) body.goalsConsent = true;
  if (o.code) body.code = o.code;
  return Object.keys(body).length ? body : undefined;
}

/** The server's role words; the app shows them as Captain / Vice-captain / Member. */
export type SettableRole = Exclude<ClubRole, 'owner'>;

export function makeClubsApi(send: Send) {
  const club = (id: string) => `/clubs/${enc(id)}`;
  return {
    /** Name prefix or first word of the area; 2–40 characters. */
    searchClubs: async (q: string): Promise<ClubCard[]> => readClubs(await send('GET', `/clubs?q=${enc(q.trim())}`)),
    myClubs: async (): Promise<ClubCard[]> => readClubs(await send('GET', '/clubs/mine')),
    club: async (id: string): Promise<ClubPage> => readClubPage(await send('GET', club(id))),
    createClub: async (f: ClubForm): Promise<Club> =>
      readClubReply(
        await send('POST', '/clubs', { name: f.name.trim(), area: f.area.trim(), about: f.about.trim(), hidden: f.hidden, goals: f.goals }),
      ),
    /** Captain or vice-captain: any of name, area, about, hidden, goals. */
    updateClub: async (id: string, patch: Partial<ClubForm>): Promise<Club> => {
      const body: Record<string, unknown> = {};
      for (const k of ['name', 'area', 'about'] as const) if (patch[k] !== undefined) body[k] = patch[k]!.trim();
      if (patch.hidden !== undefined) body.hidden = patch.hidden;
      if (patch.goals !== undefined) body.goals = patch.goals;
      return readClubReply(await send('PATCH', club(id), body));
    },
    /** Captain only. */
    deleteClub: async (id: string): Promise<void> => {
      await send('DELETE', club(id));
    },

    /** Ask to join. A club with goals needs goalsConsent (409 goals_consent without it). */
    joinClub: async (id: string, o: JoinOptions = {}): Promise<'asked' | 'member'> =>
      readJoinState(await send('POST', `${club(id)}/join`, joinBody(o))),
    cancelJoin: async (id: string): Promise<void> => {
      await send('DELETE', `${club(id)}/join`);
    },
    acceptClubInvite: async (id: string, o: JoinOptions = {}): Promise<Club> =>
      readClubReply(await send('POST', `${club(id)}/invite/accept`, joinBody(o))),
    declineClubInvite: async (id: string): Promise<void> => {
      await send('POST', `${club(id)}/invite/decline`);
    },

    clubRequests: async (id: string): Promise<RequestRow[]> => readClubRequests(await send('GET', `${club(id)}/requests`)),
    approveRequest: async (id: string, pid: string): Promise<void> => {
      await send('POST', `${club(id)}/requests/${enc(pid)}/accept`);
    },
    declineRequest: async (id: string, pid: string): Promise<void> => {
      await send('POST', `${club(id)}/requests/${enc(pid)}/decline`);
    },
    /** Invite one of my buddies (captain or vice-captain). */
    inviteBuddy: async (id: string, pid: string): Promise<void> => {
      await send('POST', `${club(id)}/invites`, { pid });
    },
    /** Captain only: make a member a vice-captain ("admin") or back to a member. At most 2 vice-captains. */
    setRole: async (id: string, pid: string, role: SettableRole): Promise<void> => {
      await send('PATCH', `${club(id)}/members/${enc(pid)}`, { role });
    },
    removeMember: async (id: string, pid: string): Promise<void> => {
      await send('DELETE', `${club(id)}/members/${enc(pid)}`);
    },
    leaveClub: async (id: string): Promise<void> => {
      await send('DELETE', `${club(id)}/members/me`);
    },

    /** While members choose a new captain: stand (or withdraw). 409 not_open, 403 not_eligible. */
    standForCaptain: async (id: string, stand: boolean): Promise<void> => {
      await send('POST', `${club(id)}/election/stand`, { stand });
    },
    /** My one secret vote, for any candidate (myself too); changeable until the vote ends. 400 not_candidate. */
    voteForCaptain: async (id: string, pid: string): Promise<void> => {
      await send('PUT', `${club(id)}/election/vote`, { pid });
    },
    clearCaptainVote: async (id: string): Promise<void> => {
      await send('DELETE', `${club(id)}/election/vote`);
    },

    setBoard: async (id: string, on: boolean): Promise<void> => {
      await send('PUT', `${club(id)}/board`, { on });
    },
    board: async (id: string): Promise<Board> => readBoard(await send('GET', `${club(id)}/board`)),

    clubReports: async (id: string): Promise<ClubReport[]> => readClubReports(await send('GET', `${club(id)}/reports`)),
    closeClubReport: async (id: string, reportId: string, action: 'dismiss' | 'removed'): Promise<void> => {
      await send('POST', `${club(id)}/reports/${enc(reportId)}/close`, { action });
    },

    /** Captain or vice-captain: a new 8-character join code for 48 hours (replaces the old one). */
    newClubCode: async (id: string): Promise<ClubCode> => readClubCode(await send('POST', `${club(id)}/code`)),
    /** The club a code belongs to (works for hidden clubs; 404 bad_code). */
    clubByCode: async (code: string): Promise<ClubCard> => {
      const r = await send('POST', '/clubs/code', { code: cleanClubCode(code) ?? code.replace(/[\s-]+/g, '').toUpperCase() });
      if (!isObj(r)) return readClubCard(null);
      return readClubCard(r.club);
    },

    /** The day's and this week's steps for the club boards (stored only while a board or family sharing is on). */
    putSteps: async (body: { day: string; steps: number; weekStart: string; weekSteps: number; tz: string }): Promise<boolean> => {
      const r = await send('PUT', '/me/steps', body);
      return isObj(r) && r.stored === true;
    },
  };
}

export type ClubsApi = ReturnType<typeof makeClubsApi>;
