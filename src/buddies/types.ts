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
