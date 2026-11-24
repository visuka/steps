/**
 * Walk buddies clubs: reading the server's answers to /v1/social/clubs*
 * (docs/walk-buddies.md 2.5 "Clubs", plus the goals and club-code contract).
 * Never trusted blindly: a broken answer throws, an odd field falls back.
 * Pure, tested in __tests__/clubs-read.test.ts.
 */
import { bad, isObj, num, readWalker, str } from './read';
import type {
  Board,
  BoardRow,
  Club,
  ClubCard,
  ClubCode,
  ClubInviteRow,
  ClubMember,
  ClubPage,
  ClubReport,
  ClubRole,
  ClubState,
  RequestRow,
  Walker,
} from './types';

const STATES: readonly ClubState[] = ['none', 'asked', 'invited', 'member'];
const ROLES: readonly ClubRole[] = ['owner', 'admin', 'member'];
/** Club ids are 12 characters of base32 (server keys.random_id). */
const CLUB_ID = /^[0-9A-Za-z]{6,24}$/;

const role = (v: unknown): ClubRole | null => (ROLES.includes(v as ClubRole) ? (v as ClubRole) : null);

function walkerOrNull(v: unknown): Walker | null {
  try {
    return isObj(v) ? readWalker(v) : null;
  } catch {
    return null;
  }
}

export function readClubCard(v: unknown): ClubCard {
  if (!isObj(v)) bad();
  const clubId = str(v.clubId, 40);
  const name = str(v.name, 80);
  if (!clubId || !CLUB_ID.test(clubId) || !name) bad();
  const myState = STATES.includes(v.myState as ClubState) ? (v.myState as ClubState) : 'none';
  // My role only for a member, and only when the server said a known one.
  const myRole = myState === 'member' ? role(v.myRole) : null;
  return {
    clubId,
    name,
    area: str(v.area, 80) ?? '',
    memberCount: Math.max(0, Math.round(num(v.memberCount))),
    myState,
    goals: v.goals === true,
    captain: walkerOrNull(v.captain),
    ...(myRole ? { myRole } : {}),
  };
}

export function readClub(v: unknown): Club {
  const card = readClubCard(v);
  const o = v as Record<string, unknown>;
  const myRole = card.myState === 'member' ? role(o.myRole) : null;
  return {
    ...card,
    about: str(o.about, 400) ?? '',
    hidden: o.hidden === true,
    myRole,
    myBoard: myRole !== null && o.myBoard === true,
  };
}

/** {"clubs": [ClubCard]}; a broken row is left out, not the whole list. */
export function readClubs(v: unknown): ClubCard[] {
  if (!isObj(v) || !Array.isArray(v.clubs)) bad();
  const out: ClubCard[] = [];
  for (const row of v.clubs) {
    try {
      out.push(readClubCard(row));
    } catch {
      // skip it
    }
  }
  return out;
}

/** {"club": Club} (create, patch, invite accept). */
export function readClubReply(v: unknown): Club {
  if (!isObj(v)) bad();
  return readClub(v.club);
}

function readMembers(v: unknown): ClubMember[] {
  if (!Array.isArray(v)) return [];
  const out: ClubMember[] = [];
  for (const m of v) {
    if (!isObj(m)) continue;
    const r = role(m.role);
    const w = walkerOrNull(m.walker);
    if (r && w) out.push({ walker: w, role: r });
  }
  return out;
}

/** GET /clubs/{id}: {"club", "members"?} (members only for members). */
export function readClubPage(v: unknown): ClubPage {
  if (!isObj(v)) bad();
  const club = readClub(v.club);
  return { club, members: club.myState === 'member' ? readMembers(v.members) : [] };
}

/** GET /clubs/{id}/requests: {"requests": [{"walker", "at"}]}. */
export function readClubRequests(v: unknown): RequestRow[] {
  if (!isObj(v) || !Array.isArray(v.requests)) bad();
  const out: RequestRow[] = [];
  for (const r of v.requests) {
    if (!isObj(r)) continue;
    const w = walkerOrNull(r.walker);
    if (w) out.push({ walker: w, at: num(r.at) });
  }
  return out;
}

/** GET /requests "clubInvites": [{"club": ClubCard, "by": Walker, "at"}]. Missing means none. */
export function readClubInvites(v: unknown): ClubInviteRow[] {
  if (!isObj(v) || !Array.isArray(v.clubInvites)) return [];
  const out: ClubInviteRow[] = [];
  for (const r of v.clubInvites) {
    if (!isObj(r)) continue;
    const by = walkerOrNull(r.by);
    let club: ClubCard;
    try {
      club = readClubCard(r.club);
    } catch {
      continue;
    }
    if (by) out.push({ club: { ...club, myState: 'invited' }, by, at: num(r.at) });
  }
  return out;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /clubs/{id}/board: {"weekStart", "rows": [{"walker", "weekSteps"}]}, high first. */
export function readBoard(v: unknown): Board {
  if (!isObj(v) || !Array.isArray(v.rows)) bad();
  const weekStart = str(v.weekStart, 10);
  const rows: BoardRow[] = [];
  for (const r of v.rows) {
    if (!isObj(r)) continue;
    const w = walkerOrNull(r.walker);
    const steps = num(r.weekSteps);
    if (w && steps >= 0) rows.push({ walker: w, weekSteps: Math.round(steps) });
  }
  rows.sort((a, b) => b.weekSteps - a.weekSteps);
  return { weekStart: weekStart && DAY.test(weekStart) ? weekStart : '', rows };
}

/** GET /clubs/{id}/reports: {"reports": [{"reportId", "kind", "reason", "snapshot", "at"}]}. */
export function readClubReports(v: unknown): ClubReport[] {
  if (!isObj(v) || !Array.isArray(v.reports)) bad();
  const out: ClubReport[] = [];
  for (const r of v.reports) {
    if (!isObj(r)) continue;
    const reportId = str(r.reportId, 40);
    if (!reportId) continue;
    const snap = isObj(r.snapshot) ? r.snapshot : {};
    const text = str(snap.text, 600) ?? (str(snap.handle, 40) ? `@${snap.handle}` : '');
    out.push({ reportId, kind: str(r.kind, 20) ?? 'other', reason: str(r.reason, 20) ?? 'other', text, at: num(r.at) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** POST /clubs/{id}/code: {"code", "codeExpiresAt"} (8 characters, Crockford base32). */
export function readClubCode(v: unknown): ClubCode {
  if (!isObj(v)) bad();
  const code = str(v.code, 16);
  if (!code || !/^[0-9A-HJKMNP-TV-Z]{8}$/.test(code)) bad();
  return { code, codeExpiresAt: num(v.codeExpiresAt) };
}

/** POST /clubs/{id}/join: {"state": "asked"} (or "member" if the server ever lets one straight in). */
export function readJoinState(v: unknown): 'asked' | 'member' {
  return isObj(v) && v.state === 'member' ? 'member' : 'asked';
}
