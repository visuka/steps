/**
 * Choosing a new captain, pure rules (owner, 24 Nov 2026: "If a captain
 * leaves the team members should go for voting and elect a captain", and
 * "club walks and goals to be formed by captains and vice captains only").
 * Who may do what while the vote is open, who may plan a club walk, and the
 * plain words for the banner, the election screen, the result line and the
 * captain's Leave dialog. Neutral words: no "won" or "lost". Tested in
 * __tests__/election.test.ts.
 */
import { addDaysToKey, dayKey } from '@/lib/dates';
import { type ClockStyle, formatClock } from '@/lib/when';

import { can, cardRole, type ClubAction, isStaff } from './clubs';
import { displayName } from './read';
import type { ClubCard, ClubElection, ClubMember, ClubRole, ElectionCandidate, LastElection } from './types';

/** A vote runs for 48 hours from when the captain left (contract). */
export const ELECTION_HOURS = 48;
/** The result line shows for 7 days after the vote closed. */
export const LAST_ELECTION_DAYS = 7;

/** My walker id in a club, from its member list (my row is "self"), or null. */
export function myPidOf(members: Pick<ClubMember, 'walker'>[]): string | null {
  return members.find((m) => m.walker.relation === 'self')?.walker.pid ?? null;
}

/**
 * The role my powers follow. While members vote, the acting captain has a
 * vice-captain's powers even when their role is still Member.
 */
export function powerRole(role: ClubRole | null | undefined, election: Pick<ClubElection, 'actingPid'> | null, myPid: string | null): ClubRole | null {
  if (!role) return null;
  if (election && role === 'member' && !!myPid && election.actingPid === myPid) return 'admin';
  return role;
}

/** No one deletes the club or changes roles while the vote is open (contract B). */
const LOCKED_IN_VOTE: readonly ClubAction[] = ['delete', 'setRole', 'removeVice'];

/** can(), with the vote's rules: the acting captain's powers, and nothing that changes who runs the club. */
export function canInClub(role: ClubRole | null | undefined, action: ClubAction, election: Pick<ClubElection, 'actingPid'> | null, myPid: string | null): boolean {
  if (election && LOCKED_IN_VOTE.includes(action)) return false;
  return can(powerRole(role, election, myPid), action);
}

/** Club walks are planned by the captain and vice-captains only (and the acting captain during a vote). */
export function canPlanClubWalk(role: ClubRole | null | undefined, election: Pick<ClubElection, 'actingPid'> | null, myPid: string | null): boolean {
  return isStaff(powerRole(role, election, myPid));
}

/**
 * Plan a walk's club chips: only the clubs I captain or vice-captain (my role
 * from GET /clubs/mine), and the club whose vote I keep running as acting
 * captain (the card's "acting" while "electionOpen").
 */
export function canPlanForCard(c: Pick<ClubCard, 'myState' | 'myRole' | 'captain' | 'electionOpen' | 'acting'>): boolean {
  if (c.myState === 'member' && c.electionOpen && c.acting) return true;
  return isStaff(cardRole(c));
}

/** What a member sees in a club's Walks tab instead of Plan a club walk. */
export const STAFF_PLANS_LINE = 'The captain and vice-captains plan club walks.';

/** When the vote ends, mid-sentence: "today 6:00 pm", "tomorrow 6:00 pm", "Thu 6:00 pm". */
export function endsWords(endsAt: number, now: number, style: ClockStyle): string {
  const today = dayKey(new Date(now));
  const day = dayKey(new Date(endsAt));
  const time = formatClock(endsAt, style);
  if (day === today) return `today ${time}`;
  if (day === addDaysToKey(today, 1)) return `tomorrow ${time}`;
  return `${WEEKDAYS[new Date(endsAt).getDay()]} ${time}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The club screen's banner, a title and a muted caption so a large font
 * breaks between them, never mid-phrase: "Choosing a new captain" /
 * "Voting ends Thu 6:00 pm".
 */
export function bannerWords(e: Pick<ClubElection, 'endsAt'>, now: number, style: ClockStyle): { title: string; caption: string } {
  return { title: 'Choosing a new captain', caption: `Voting ends ${endsWords(e.endsAt, now, style)}` };
}

/** The banner's button: Vote for someone who can vote and hasn't, else a look at who is standing. */
export function bannerButton(e: Pick<ClubElection, 'canVote' | 'myVote'>): string {
  if (!e.canVote) return 'See who is standing';
  return e.myVote ? 'Change vote' : 'Vote';
}

/** How it works, three short lines (contract C). */
export const HOW_IT_WORKS = [
  'Anyone who was a member when voting started can stand and vote.',
  'Your vote is secret. No one sees who voted for whom.',
  'Whoever gets the most votes becomes captain. A tie goes to whoever joined first.',
] as const;

/** "@ravi_walks is the acting captain until voting ends.", "You're the acting captain…", or null. */
export function actingWords(e: Pick<ClubElection, 'actingPid' | 'candidates'>, members: ClubMember[], myPid: string | null): string | null {
  if (!e.actingPid) return null;
  if (e.actingPid === myPid) return "You're the acting captain until voting ends.";
  const handle = members.find((m) => m.walker.pid === e.actingPid)?.walker.handle ?? e.candidates.find((c) => c.pid === e.actingPid)?.handle;
  return handle ? `@${handle} is the acting captain until voting ends.` : null;
}

/** A candidate's button: Your vote (this one), else Vote, whether or not I voted for someone else. */
export function voteWord(pid: string, myVote: string | null): 'Vote' | 'Your vote' {
  return myVote === pid ? 'Your vote' : 'Vote';
}

/** The candidates by name, so the order says nothing about how the vote is going. */
export function candidateOrder(list: ElectionCandidate[]): ElectionCandidate[] {
  return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b)) || a.handle.localeCompare(b.handle));
}

/**
 * A candidate's second line: "@handle" or "You · @handle" under a name; with
 * no name the title is already the handle, so "You" for me and nothing else.
 */
export function candidateLine(c: ElectionCandidate): string | undefined {
  const named = !!c.name?.trim();
  if (c.isMe) return named ? `You · @${c.handle}` : 'You';
  return named ? `@${c.handle}` : undefined;
}

/** The empty Standing list's hint: who becomes captain if no one stands. */
export function noOneStandsWords(e: Pick<ClubElection, 'actingPid' | 'candidates'>, members: ClubMember[], myPid: string | null): string {
  if (!e.actingPid) return 'If no one stands, the acting captain becomes captain.';
  if (e.actingPid === myPid) return 'If no one stands, you stay on as captain.';
  const handle = members.find((m) => m.walker.pid === e.actingPid)?.walker.handle ?? e.candidates.find((c) => c.pid === e.actingPid)?.handle;
  return handle ? `If no one stands, @${handle} becomes captain.` : 'If no one stands, the acting captain becomes captain.';
}

/** The Stand for captain switch's note. */
export function standNote(e: Pick<ClubElection, 'canVote' | 'iStand'>): string {
  if (!e.canVote) return 'Only people who were members when voting started can stand and vote.';
  return e.iStand ? "You're standing. You can withdraw until voting ends." : 'Members can vote for you until voting ends.';
}

/** The result line on the club screen for 7 days: "@meera.k is the new captain." or "You're the new captain."; null after. */
export function lastElectionWords(last: LastElection | null, now: number, myPid: string | null): string | null {
  if (!last || now - last.decidedAt > LAST_ELECTION_DAYS * 86_400_000) return null;
  return last.winnerPid === myPid ? "You're the new captain." : `@${last.handle} is the new captain.`;
}

/** Buddies home, a club row's extra line while members vote. */
export function cardElectionWords(c: Pick<ClubCard, 'electionOpen' | 'myState'>): string | null {
  return c.myState === 'member' && c.electionOpen ? 'Voting for captain' : null;
}

const CAPTAIN_LEAVE =
  "Members will vote for a new captain over the next 2 days. You leave the club chat and the board. If the club has shared goals, your goal history here is deleted. You can't undo this.";

/** What Leave club asks: the only member deletes the club; the captain's leaving starts a 2-day vote. */
export function leaveAsk(role: ClubRole | null, memberCount: number, name: string): { title: string; message: string; confirm: string } {
  const title = `Leave ${name}?`;
  if (memberCount <= 1) return { title, message: "You're the only member. Leaving deletes the club.", confirm: 'Leave and delete' };
  if (role === 'owner') return { title, message: CAPTAIN_LEAVE, confirm: 'Leave' };
  return { title, message: "You leave the club chat and the board. If the club has shared goals, your goal history here is deleted.", confirm: 'Leave' };
}

/** leaveAsk for a club card (Your clubs without Premium): my role from the card. */
export function cardLeaveAsk(c: Pick<ClubCard, 'myState' | 'myRole' | 'captain' | 'memberCount' | 'name'>): { title: string; message: string; confirm: string } {
  return leaveAsk(cardRole(c), c.memberCount, c.name);
}

/** The snackbar after a vote, a change or a clear. */
export function voteDoneWords(pid: string | null, candidates: ElectionCandidate[]): string {
  if (!pid) return 'Your vote is cleared.';
  const c = candidates.find((x) => x.pid === pid);
  if (c?.isMe) return 'You voted for yourself. Your vote is secret.';
  return c ? `You voted for ${displayName(c)}. Your vote is secret.` : 'Your vote is in. It is secret.';
}
