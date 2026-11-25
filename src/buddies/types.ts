/**
 * Walk buddies: the shapes the server answers with (stepsinfra
 * lambda_src/python/steps/social, routes in docs/walk-buddies.md 2.5).
 * Times are epoch ms.
 */

export type Relation = 'none' | 'buddy' | 'requested' | 'asked_me' | 'self';

export interface Walker {
  pid: string;
  handle: string;
  /** Only for buddies, people who asked me, and me. Strangers see the handle only. */
  name: string | null;
  relation: Relation;
}

export interface SocialCounts {
  requestsIn: number;
  unread: number;
  clubInvites: number;
  clubRequests: number;
}

export type SocialMe =
  | { joined: false }
  | {
      joined: true;
      pid: string;
      handle: string;
      name: string | null;
      handleChangeFrom: number;
      nearby: boolean;
      /** The day the area was last sent, YYYY-MM-DD, or null. */
      areaSetOn: string | null;
      counts: SocialCounts;
      /** Notification switches; missing in a copy saved by an older build (read.ts notifyOf gives the defaults). */
      notify?: NotifyPrefs;
    };

/** Walkers in my area: handles only, no names, areas or distances. */
export interface Nearby {
  walkers: Walker[];
  areaSetOn: string | null;
}

export interface RequestRow {
  walker: Walker;
  at: number;
}

export interface Requests {
  incoming: RequestRow[];
  outgoing: RequestRow[];
  /** Clubs a captain or vice-captain invited me to (GET /requests "clubInvites"). */
  clubInvites?: ClubInviteRow[];
}

export interface BuddyRow {
  walker: Walker;
  since: number;
}

export type ChatKind = 'buddy' | 'club' | 'family';

export interface ChatRow {
  /** b.<pid>, c.<clubId> or f.<famId>. */
  key: string;
  kind: ChatKind;
  title: string;
  lastAt: number;
  lastText: string | null;
  lastMine: boolean;
  unread: number;
}

export interface Message {
  id: string;
  mine: boolean;
  from: { pid: string; handle: string; name: string | null };
  text: string;
  at: number;
  /** Phone-only: still sending, or failed (tap to retry). */
  state?: 'sending' | 'failed';
  /** Phone-only: the id the phone gave this send, so a retry can't double it. */
  clientId?: string;
}

export interface MessagePage {
  messages: Message[];
  more: boolean;
}

// ── clubs (docs/walk-buddies.md 2.5 "Clubs", plus the goals and club-code contract) ──

/** The server's roles; the app says Captain, Vice-captain and Member (clubs.ts ROLE_WORD). */
export type ClubRole = 'owner' | 'admin' | 'member';

/** Where I stand with a club. */
export type ClubState = 'none' | 'asked' | 'invited' | 'member';

export interface ClubCard {
  clubId: string;
  name: string;
  /** A typed place name, like "Banjara Hills" (never a position). */
  area: string;
  memberCount: number;
  myState: ClubState;
  /** The club has shared goals: joining needs the goals consent. */
  goals: boolean;
  /** The captain (the server's owner), for display; null when the server didn't say. */
  captain: Walker | null;
  /** My role, when the server says it on a card (GET /clubs/mine); left out otherwise. */
  myRole?: ClubRole | null;
}

export interface Club extends ClubCard {
  about: string;
  hidden: boolean;
  /** Null when I am not a member. */
  myRole: ClubRole | null;
  /** My steps are on this club's weekly board. */
  myBoard: boolean;
}

export interface ClubMember {
  walker: Walker;
  role: ClubRole;
  /** When they joined (epoch ms), when the server says; left out otherwise. */
  joinedAt?: number;
}

/** GET /clubs/{id}: the club, and its members when I am one. */
export interface ClubPage {
  club: Club;
  members: ClubMember[];
}

export interface ClubInviteRow {
  club: ClubCard;
  by: Walker;
  at: number;
}

export interface BoardRow {
  walker: Walker;
  weekSteps: number;
}

export interface Board {
  /** The Monday the week starts on, YYYY-MM-DD. */
  weekStart: string;
  rows: BoardRow[];
}

/** A report a club's captain or vice-captain can act on. */
export interface ClubReport {
  reportId: string;
  kind: string;
  reason: string;
  /** What was reported, copied at report time (message text, handle…). */
  text: string;
  at: number;
}

export interface ClubCode {
  code: string;
  codeExpiresAt: number;
}

/** POST /clubs and PATCH /clubs/{id}. */
export interface ClubForm {
  name: string;
  area: string;
  about: string;
  hidden: boolean;
  goals: boolean;
}

// ── walk plans (docs/walk-buddies.md 2.5 "Plans", T16e) ──

/** My answer to a plan; the organiser's is always "going". */
export type PlanAnswer = 'none' | 'going' | 'not_going';

export interface Plan {
  planId: string;
  /** relation "self" when I made it. */
  organiser: Walker;
  /** A club plan: everyone in the club can see it. */
  club: { clubId: string; name: string } | null;
  /** Epoch ms. */
  startsAt: number;
  /** The organiser's time zone (IANA). */
  tz: string;
  /** A typed place name (never a position). */
  place: string;
  note: string;
  status: 'on' | 'cancelled';
  myAnswer: PlanAnswer;
  /** Counts of other people's answers (block rules applied by the server). */
  going: number;
  notGoing: number;
}

export interface PlanInvitee {
  walker: Walker;
  answer: PlanAnswer;
}

/** GET /plans/{id}: the plan and who answered (club plans: only people who answered). */
export interface PlanPage {
  plan: Plan;
  invitees: PlanInvitee[];
}

/** POST /plans: buddies (1–20 pids) or one club. */
export interface PlanForm {
  startsAt: number;
  place: string;
  note: string;
  invite: string[];
  clubId: string | null;
}

export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'under18', label: 'Under 18' },
  { key: 'danger', label: 'Threat or danger' },
  { key: 'impersonation', label: 'Pretending to be someone' },
  { key: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

/** The terms version the join form agrees to (server SocialConfig). */
export const TERMS_VERSION = '2026-11';

// ── shared club goals (the goals contract; the owner's Teams with shared goals, 18 Nov 2026) ──

/** What a goal is about. "other" is shown as "Anything". */
export type GoalKind = 'steps' | 'walk' | 'water' | 'sleep' | 'medicine' | 'other';

/** auto: the phone marks it from its own data (steps, walk, water, sleep only); tap: the member taps Done. */
export type GoalCounted = 'auto' | 'tap';

export interface Goal {
  goalId: string;
  title: string;
  kind: GoalKind;
  /** steps: 500–50000; walk: minutes 5–240; water: glasses 1–20; sleep: minutes 180–720. Null when none. */
  target: number | null;
  /** "HH:MM" on the phone's clock, or null. */
  byTime: string | null;
  /** Days of the week it is due, Monday = 0 … Sunday = 6 (never empty). */
  days: number[];
  counted: GoalCounted;
  paused: boolean;
  createdBy: Walker | null;
  createdAt: number;
}

/** My mark for one goal on one day. */
export interface GoalMark {
  goalId: string;
  done: boolean;
  /** When it was marked done (epoch ms), or null. */
  at: number | null;
  /** The step total, for step goals only. */
  value: number | null;
}

/** GET /clubs/{id}/goals?day=: the club's goals, whether I gave consent, and my marks that day. */
export interface ClubGoals {
  goals: Goal[];
  tracked: boolean;
  mine: GoalMark[];
}

export interface GoalReportRow {
  walker: Walker;
  role: ClubRole;
  today: { done: boolean; at: number | null; value: number | null };
  /** The last 7 days ending on the report's day: days it was due while they were in, and how many were done. */
  week: { done: number; of: number };
  everDone: boolean;
}

/** GET /clubs/{id}/goals/{goalId}/report?day= (captain and vice-captains). */
export interface GoalReport {
  day: string;
  goal: Goal;
  /** Tracked members the goal applies to. */
  members: number;
  doneToday: number;
  neverDone: number;
  /** Not done today first, then by name. */
  rows: GoalReportRow[];
}

/** GET /clubs/{id}/goals/summary?day=: one row per goal. */
export interface GoalSummaryRow {
  goalId: string;
  doneToday: number;
  members: number;
}

/** POST /clubs/{id}/goals; PATCH takes title, target, byTime, days and paused. */
export interface GoalForm {
  title: string;
  kind: GoalKind;
  target: number | null;
  byTime: string | null;
  days: number[];
  counted: GoalCounted;
}

/** The notification switches on /me (server push.DEFAULT_NOTIFY). */
export interface NotifyPrefs {
  messages: boolean;
  requests: boolean;
  plans: boolean;
  clubChat: boolean;
  family: boolean;
  /** Reminders from a club's captain or vice-captains about a shared goal. */
  goals: boolean;
  preview: boolean;
}
