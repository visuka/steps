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
