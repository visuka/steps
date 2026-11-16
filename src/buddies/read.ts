/**
 * Walk buddies: reading the server's answers (never trusted blindly) and
 * turning errors into a kind and a plain message. Pure, tested.
 */
import type {
  BuddyRow,
  ChatKind,
  ChatRow,
  Message,
  MessagePage,
  Nearby,
  Relation,
  RequestRow,
  Requests,
  SocialMe,
  Walker,
} from './types';

export type SocialErrorKind =
  | 'signin'
  | 'premium'
  | 'offline'
  | 'not_found'
  | 'forbidden'
  | 'banned'
  | 'not_joined'
  | 'limit'
  | 'text'
  | 'handle_taken'
  | 'handle_invalid'
  | 'handle_too_soon'
  | 'adult'
  | 'terms'
  | 'conflict'
  | 'busy'
  | 'outside'
  | 'nearby_off'
  | 'other';

export const SOCIAL_MESSAGES: Record<SocialErrorKind, string> = {
  signin: 'Sign in again to use Walk buddies.',
  premium: 'Walk buddies is part of Premium.',
  offline: "You're offline. Try again when you're connected.",
  not_found: 'Not found.',
  forbidden: "You can't do that here.",
  banned: "You can't use Walk buddies.",
  not_joined: 'Set up Walk buddies first.',
  limit: "You've reached today's limit. Try again tomorrow.",
  text: "That can't be sent. Links, phone numbers and some words aren't allowed.",
  handle_taken: 'That walker ID is taken.',
  handle_invalid: 'Use 3–20 letters, numbers or _.',
  handle_too_soon: 'You can change your walker ID once a month.',
  adult: 'Walk buddies is for people 18 and over.',
  terms: 'Please agree to the Walk buddies rules.',
  conflict: "That can't be done right now.",
  busy: 'Too busy just now. Try again in a moment.',
  outside: 'Walkers in your area works only in India for now.',
  nearby_off: 'Show yourself to walkers in your area first.',
  other: 'Something went wrong. Try again.',
};

export class SocialError extends Error {
  constructor(
    readonly kind: SocialErrorKind,
    readonly code?: string,
    readonly why?: string,
  ) {
    super(SOCIAL_MESSAGES[kind]);
    this.name = 'SocialError';
  }
}

const CODE_KIND: Record<string, SocialErrorKind> = {
  unauthorized: 'signin',
  premium_required: 'premium',
  not_found: 'not_found',
  forbidden: 'forbidden',
  banned: 'banned',
  not_joined: 'not_joined',
  daily_limit: 'limit',
  open_limit: 'limit',
  rate_limited: 'limit',
  join_limit: 'limit',
  declined_recently: 'limit',
  text_not_allowed: 'text',
  handle_taken: 'handle_taken',
  handle_invalid: 'handle_invalid',
  handle_too_soon: 'handle_too_soon',
  adult_required: 'adult',
  terms_required: 'terms',
  already: 'conflict',
  conflict: 'conflict',
  unavailable: 'busy',
  not_available: 'outside',
  nearby_off: 'nearby_off',
};

/** status null = the request never got an answer (offline). */
export function socialErrorFor(status: number | null, code?: string, why?: string): SocialError {
  if (status === null) return new SocialError('offline');
  if (code && CODE_KIND[code]) return new SocialError(CODE_KIND[code], code, why);
  if (status === 401) return new SocialError('signin', code);
  if (status === 402) return new SocialError('premium', code);
  if (status === 429) return new SocialError('limit', code);
  if (status === 503) return new SocialError('busy', code);
  return new SocialError('other', code);
}

// ── reading ──────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 600): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const RELATIONS: readonly Relation[] = ['none', 'buddy', 'requested', 'asked_me', 'self'];

function bad(): never {
  throw new SocialError('other', 'bad_answer');
}

export function readWalker(v: unknown): Walker {
  if (!isObj(v)) bad();
  const pid = str(v.pid, 64);
  const handle = str(v.handle, 40);
  if (!pid || !handle) bad();
  const relation = RELATIONS.includes(v.relation as Relation) ? (v.relation as Relation) : 'none';
  return { pid, handle, name: str(v.name, 80) || null, relation };
}

export function readMe(v: unknown): SocialMe {
  if (!isObj(v)) bad();
  if (v.joined !== true) return { joined: false };
  const pid = str(v.pid, 64);
  const handle = str(v.handle, 40);
  if (!pid || !handle) bad();
  const c = isObj(v.counts) ? v.counts : {};
  return {
    joined: true,
    pid,
    handle,
    name: str(v.name, 80) || null,
    handleChangeFrom: num(v.handleChangeFrom),
    nearby: v.nearby === true,
    areaSetOn: str(v.areaSetOn, 10) || null,
    counts: {
      requestsIn: num(c.requestsIn),
      unread: num(c.unread),
      clubInvites: num(c.clubInvites),
      clubRequests: num(c.clubRequests),
    },
  };
}

/** The badge number on the Plus tab and its rows. */
export function badgeCount(me: SocialMe | null): number {
  if (!me || !me.joined) return 0;
  const c = me.counts;
  return c.requestsIn + c.unread + c.clubInvites + c.clubRequests;
}

function readRows(v: unknown): RequestRow[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).map((r) => ({ walker: readWalker(r.walker), at: num(r.at) }));
}

export function readNearby(v: unknown): Nearby {
  if (!isObj(v)) bad();
  const list = Array.isArray(v.walkers) ? v.walkers : [];
  return { walkers: list.map(readWalker), areaSetOn: str(v.areaSetOn, 10) || null };
}

export function readRequests(v: unknown): Requests {
  if (!isObj(v)) bad();
  return { incoming: readRows(v.incoming), outgoing: readRows(v.outgoing) };
}

export function readBuddies(v: unknown): BuddyRow[] {
  if (!isObj(v) || !Array.isArray(v.buddies)) bad();
  return v.buddies.filter(isObj).map((r) => ({ walker: readWalker(r.walker), since: num(r.since) }));
}

const KINDS: readonly ChatKind[] = ['buddy', 'club', 'family'];

export function readChats(v: unknown): ChatRow[] {
  if (!isObj(v) || !Array.isArray(v.chats)) bad();
  const out: ChatRow[] = [];
  for (const r of v.chats) {
    if (!isObj(r)) continue;
    const key = str(r.key, 80);
    if (!key) continue;
    out.push({
      key,
      kind: KINDS.includes(r.kind as ChatKind) ? (r.kind as ChatKind) : 'buddy',
      title: str(r.title, 80) ?? '',
      lastAt: num(r.lastAt),
      lastText: str(r.lastText, 600),
      lastMine: r.lastMine === true,
      unread: num(r.unread),
    });
  }
  return out.sort((a, b) => b.lastAt - a.lastAt);
}

export function readMessage(v: unknown): Message {
  if (!isObj(v)) bad();
  const id = str(v.id, 80);
  const text = str(v.text, 600);
  if (!id || text === null) bad();
  const f = isObj(v.from) ? v.from : {};
  return {
    id,
    mine: v.mine === true,
    from: { pid: str(f.pid, 64) ?? '', handle: str(f.handle, 40) ?? '', name: str(f.name, 80) || null },
    text,
    at: num(v.at),
  };
}

export function readPage(v: unknown): MessagePage {
  if (!isObj(v) || !Array.isArray(v.messages)) bad();
  return { messages: v.messages.map(readMessage), more: v.more === true };
}

/** What a person is called on screen: their name, else @handle. */
export function displayName(w: { name: string | null; handle: string }): string {
  return w.name?.trim() ? w.name.trim() : `@${w.handle}`;
}

/** The chat key for a buddy. */
export const buddyChatKey = (pid: string) => `b.${pid}`;
