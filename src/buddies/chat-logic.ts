/**
 * Walk buddies, pure helpers: the walker ID check, the polling rhythm, and
 * merging message pages with sends that are still on their way. Tested.
 */
import type { Message } from './types';

// ── walker ID (same rule as the server's filter.py) ──────────────────────

const HANDLE = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = /^(?:admin|steps|neutcrafts|support|moderator|official)[\d_]*$/i;

/** Trim, drop a leading @. */
export function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

/** A plain reason the ID can't be used, or null. */
export function handleProblem(raw: string): string | null {
  const h = cleanHandle(raw);
  if (h.length < 3) return 'At least 3 characters.';
  if (h.length > 20) return 'At most 20 characters.';
  if (!HANDLE.test(h)) return 'Only letters, numbers and _.';
  if (RESERVED.test(h)) return 'That ID is reserved.';
  return null;
}

// ── message text ─────────────────────────────────────────────────────────

export const MESSAGE_MAX = 500;

export function messageProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return 'empty';
  if (t.length > MESSAGE_MAX) return 'Too long.';
  return null;
}

/** "480/500", shown from 450 characters. */
export function countLabel(text: string): string | null {
  return text.length >= 450 ? `${text.length}/${MESSAGE_MAX}` : null;
}

// ── polling (docs/walk-buddies.md 3.2) ───────────────────────────────────

export interface PollState {
  /** When something last arrived or was sent. */
  lastActivityAt: number;
  /** A 429 since the last success. */
  throttled: boolean;
}

/** Wait before the next poll of an open chat: 4 s, then 10 s after a quiet minute, 30 s after 5 min or a 429. */
export function nextDelay(state: PollState, now: number): number {
  if (state.throttled) return 30_000;
  const quiet = now - state.lastActivityAt;
  if (quiet >= 5 * 60_000) return 30_000;
  if (quiet >= 60_000) return 10_000;
  return 4_000;
}

// ── merging ──────────────────────────────────────────────────────────────

/**
 * Server messages (in any order, pages may overlap) plus the phone's own
 * pending or failed sends, oldest first. A pending send disappears once the
 * server copy (same text, sent after it was queued) has arrived.
 */
export function mergeMessages(server: Message[], local: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of server) byId.set(m.id, m);
  const fromServer = [...byId.values()];
  const waiting = local.filter(
    (l) => !fromServer.some((s) => s.mine && s.text === l.text.trim() && s.at >= l.at - 60_000),
  );
  return [...fromServer, ...waiting].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** The newest server message id, for `?after=`. */
export function newestId(messages: Message[]): string | undefined {
  let best: Message | undefined;
  for (const m of messages) if (!m.state && (!best || m.at >= best.at)) best = m;
  return best?.id;
}

/** A random id the server uses to make a retried send land once (16–36 chars). */
export function newClientId(random: () => number = Math.random): string {
  let s = '';
  while (s.length < 24) s += Math.floor(random() * 36).toString(36);
  return s.slice(0, 24);
}

export type ChatItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; message: Message; firstOfGroup: boolean; lastOfGroup: boolean };

/** Day dividers and grouping (same sender within 5 minutes), oldest first. */
export function chatItems(messages: Message[], dayLabel: (at: number) => string): ChatItem[] {
  const out: ChatItem[] = [];
  let lastDay = '';
  messages.forEach((m, i) => {
    const day = dayLabel(m.at);
    if (day !== lastDay) {
      out.push({ type: 'day', key: `d-${day}-${m.id}`, label: day });
      lastDay = day;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const same = (a?: Message, b?: Message) =>
      !!a && !!b && a.from.pid === b.from.pid && a.mine === b.mine && Math.abs(a.at - b.at) < 5 * 60_000 && dayLabel(a.at) === dayLabel(b.at);
    out.push({ type: 'msg', key: m.id, message: m, firstOfGroup: !same(prev, m), lastOfGroup: !same(m, next) });
  });
  return out;
}
