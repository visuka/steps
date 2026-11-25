/**
 * Walk buddies clubs, pure rules: the role words the owner chose (Captain,
 * Vice-captain, Member), who may do what, the member list order, the board's
 * ranks, the club form's checks and the plain words for club errors. Tested
 * in __tests__/clubs.test.ts.
 */
import { displayName, SocialError } from './read';
import type { BoardRow, ClubCard, ClubForm, ClubMember, ClubRole } from './types';

/** The owner's words (18 Nov 2026); the server keeps owner / admin / member. */
export const ROLE_WORD: Record<ClubRole, string> = { owner: 'Captain', admin: 'Vice-captain', member: 'Member' };

/** At most two vice-captains per club (contract). */
export const VICE_MAX = 2;

export type ClubAction =
  | 'edit'
  | 'delete'
  | 'approve'
  | 'invite'
  | 'setRole'
  | 'removeMember'
  | 'removeVice'
  | 'reports'
  | 'code'
  | 'leave'
  | 'board'
  | 'chat';

/** Who may do what (server clubs.py: _staff_mem, set_role, remove_member, delete). */
const CAN: Record<ClubAction, readonly ClubRole[]> = {
  edit: ['owner', 'admin'],
  delete: ['owner'],
  approve: ['owner', 'admin'],
  invite: ['owner', 'admin'],
  setRole: ['owner'],
  removeMember: ['owner', 'admin'],
  removeVice: ['owner'],
  reports: ['owner', 'admin'],
  code: ['owner', 'admin'],
  leave: ['owner', 'admin', 'member'],
  board: ['owner', 'admin', 'member'],
  chat: ['owner', 'admin', 'member'],
};

export function can(role: ClubRole | null | undefined, action: ClubAction): boolean {
  return !!role && CAN[action].includes(role);
}

export const isStaff = (role: ClubRole | null | undefined) => role === 'owner' || role === 'admin';

const ROLE_ORDER: Record<ClubRole, number> = { owner: 0, admin: 1, member: 2 };

/** Captain first, then vice-captains, then members; by name within each. */
export function sortMembers(members: ClubMember[]): ClubMember[] {
  return [...members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || displayName(a.walker).localeCompare(displayName(b.walker)),
  );
}

export const viceCount = (members: ClubMember[]) => members.filter((m) => m.role === 'admin').length;

/** What the captain may do to a member's role, or null (the captain themself, or the vice-captain seats are full). */
export function roleChange(target: ClubMember, members: ClubMember[]): { to: 'admin' | 'member'; label: string } | null {
  if (target.role === 'owner') return null;
  if (target.role === 'admin') return { to: 'member', label: 'Make member' };
  if (viceCount(members) >= VICE_MAX) return null;
  return { to: 'admin', label: 'Make vice-captain' };
}

/** Whether I (in `myRole`) may remove this member: never the captain; a vice-captain only by the captain; never myself (that is Leave). */
export function canRemove(myRole: ClubRole | null, target: ClubMember, myPid: string | null): boolean {
  if (!myRole || target.role === 'owner' || target.walker.pid === myPid || target.walker.relation === 'self') return false;
  if (target.role === 'admin') return can(myRole, 'removeVice');
  return can(myRole, 'removeMember');
}

export interface RankedRow extends BoardRow {
  /** 1, 2, 3…; equal steps share a rank. */
  rank: number;
}

/** The board, high first, with ranks (equal steps share one). */
export function boardRows(rows: BoardRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) => b.weekSteps - a.weekSteps || displayName(a.walker).localeCompare(displayName(b.walker)));
  let rank = 0;
  let last = -1;
  return sorted.map((r, i) => {
    if (r.weekSteps !== last) {
      rank = i + 1;
      last = r.weekSteps;
    }
    return { ...r, rank };
  });
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/** "Banjara Hills · 48 members". */
export function clubLine(c: Pick<ClubCard, 'area' | 'memberCount'>): string {
  return [c.area.trim(), count(c.memberCount, 'member', 'members')].filter(Boolean).join(' · ');
}

/** The search row's right side: what I can do, or where I stand. */
export function stateWord(c: Pick<ClubCard, 'myState'>): string {
  switch (c.myState) {
    case 'member':
      return 'Member';
    case 'asked':
      return 'Asked';
    case 'invited':
      return 'Invited';
    default:
      return 'Ask to join';
  }
}

/**
 * My role on a club card: what the server said (GET /clubs/mine may send myRole), else
 * Captain when the card's captain is me; null when it is not known or I am not a member.
 */
export function cardRole(c: Pick<ClubCard, 'myState' | 'myRole' | 'captain'>): ClubRole | null {
  if (c.myState !== 'member') return null;
  if (c.myRole) return c.myRole;
  return c.captain?.relation === 'self' ? 'owner' : null;
}

/** Club walks are planned by the captain and vice-captains only (owner, 24 Nov 2026). */
export const canPlanClubWalk = (role: ClubRole | null | undefined) => isStaff(role);

/** Plan a walk's club chips: only the clubs I captain or vice-captain (my role from GET /clubs/mine). */
export const canPlanForCard = (c: Pick<ClubCard, 'myState' | 'myRole' | 'captain'>) => isStaff(cardRole(c));

/** What a member sees in a club's Walks tab instead of Plan a club walk (and the server's 403 staff_only). */
export const STAFF_PLANS_LINE = 'The captain and vice-captains plan club walks.';

/**
 * Who becomes captain when the captain leaves (the server's rule, owner 25 Nov 2026):
 * the vice-captain who joined first, else the member who joined first. Null when the
 * list can't tell (no one else in it, or a join time missing).
 */
export function heirOf(members: ClubMember[]): ClubMember | null {
  const others = members.filter((m) => m.role !== 'owner' && m.walker.relation !== 'self');
  if (!others.length || others.some((m) => !m.joinedAt)) return null;
  return [...others].sort((a, b) => Number(a.role !== 'admin') - Number(b.role !== 'admin') || (a.joinedAt ?? 0) - (b.joinedAt ?? 0))[0];
}

const LEAVE_WORDS = 'You leave the club chat and the board. If the club has shared goals, your goal history here is deleted.';
const NO_UNDO = "You can't undo this.";

/**
 * What Leave club asks. The captain hands the club over at once: the dialog names
 * who takes over only when the member list is complete (the server leaves out people I
 * blocked, and ranks everyone), else says the rule; the only member deletes it.
 */
export function leaveAsk(role: ClubRole | null, memberCount: number, name: string, members: ClubMember[] = []): { title: string; message: string; confirm: string } {
  const title = `Leave ${name}?`;
  if (role !== 'owner') return { title, message: LEAVE_WORDS, confirm: 'Leave' };
  if (memberCount <= 1) return { title, message: `You're the only member, so the club is deleted. ${NO_UNDO}`, confirm: 'Leave and delete' };
  const heir = members.length === memberCount ? heirOf(members) : null;
  const who = heir
    ? `${displayName(heir.walker)} becomes captain.`
    : 'A vice-captain becomes captain, or the member who joined first if there is none.';
  return { title, message: `${who} ${LEAVE_WORDS} ${NO_UNDO}`, confirm: 'Leave' };
}

/** leaveAsk for a club card (Your clubs without Premium): my role from the card, no member list. */
export function cardLeaveAsk(c: Pick<ClubCard, 'myState' | 'myRole' | 'captain' | 'memberCount' | 'name'>): { title: string; message: string; confirm: string } {
  return leaveAsk(cardRole(c), c.memberCount, c.name);
}

/** Buddies home, a club row's right side: Captain, Vice-captain or Member, or Asked / Invited; '' when not known. */
export function standWordOf(c: Pick<ClubCard, 'myState' | 'myRole' | 'captain'>): string {
  if (c.myState === 'asked') return 'Asked';
  if (c.myState === 'invited') return 'Invited';
  const r = cardRole(c);
  return r ? ROLE_WORD[r] : '';
}

export const NAME_MIN = 3;
export const NAME_MAX = 40;
export const AREA_MAX = 40;
export const ABOUT_MAX = 200;

/** A plain reason the club form can't be sent, or null (same limits as the server's clubs.py). */
export function clubProblem(f: Pick<ClubForm, 'name' | 'area' | 'about'>): string | null {
  const name = f.name.trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN) return 'Give the club a name of at least 3 letters.';
  if (name.length > NAME_MAX) return 'The name can be at most 40 characters.';
  if (f.area.trim().length > AREA_MAX) return 'The area can be at most 40 characters.';
  if (f.about.trim().length > ABOUT_MAX) return 'About can be at most 200 characters.';
  return null;
}

/** A search the server takes: 2–40 characters. */
export function searchReady(q: string): boolean {
  const t = q.trim();
  return t.length >= 2 && t.length <= 40;
}

/** Joining this club first shows the goals consent screen. */
export const needsConsent = (c: Pick<ClubCard, 'goals'>) => c.goals;

/** The server's 409 goals_consent: the club turned on shared goals after the phone last looked. */
export const isConsentError = (e: unknown) => e instanceof SocialError && e.why === 'goals_consent';

/** Plain words for a club error, by the server's `why` when it gave one. */
export function clubErrorText(e: unknown): string {
  if (!(e instanceof SocialError)) return 'Something went wrong. Try again.';
  switch (e.why ?? e.code) {
    case 'club_full':
      return 'This club is full (200 members).';
    case 'club_limit':
      return 'You can be in 10 clubs and start 3.';
    case 'goals_consent':
      return 'This club has shared goals. Agree to them to join.';
    case 'join_limit':
      return 'You can ask to join 5 clubs at a time.';
    case 'declined_recently':
      return 'This club said no recently. You can ask again after 30 days.';
    case 'bad_code':
      return 'That code is wrong or has run out. Ask for a new one.';
    case 'admin_limit':
    case 'vice_limit':
      return 'A club can have 2 vice-captains.';
    case 'already':
      return 'Already done.';
    case 'daily_limit':
      return "You've reached today's limit. Try again tomorrow.";
    case 'staff_only':
      return STAFF_PLANS_LINE;
  }
  return e.message;
}

export interface JoinCalls {
  joinClub: (id: string, o?: { goalsConsent?: boolean; code?: string }) => Promise<'asked' | 'member'>;
  acceptClubInvite: (id: string, o?: { goalsConsent?: boolean; code?: string }) => Promise<unknown>;
}

/**
 * Join a club the right way: an invite is accepted (I'm in at once), anything
 * else asks the captain and vice-captains. A club with shared goals is joined
 * only with the person's consent (the consent screen), so without it nothing is sent.
 */
export async function joinOrAccept(
  api: JoinCalls,
  club: Pick<ClubCard, 'clubId' | 'myState' | 'goals'>,
  o: { consent?: boolean; code?: string } = {},
): Promise<'asked' | 'member' | 'needs_consent'> {
  if (club.goals && !o.consent) return 'needs_consent';
  const body = { ...(club.goals ? { goalsConsent: true } : {}), ...(o.code ? { code: o.code } : {}) };
  if (club.myState === 'invited') {
    await api.acceptClubInvite(club.clubId, body);
    return 'member';
  }
  return api.joinClub(club.clubId, body);
}
