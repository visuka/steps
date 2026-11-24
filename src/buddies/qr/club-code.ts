/**
 * Club QR codes, pure rules: the codes I made, kept on this phone so opening
 * the Club QR sheet again shows the same code (a new one would stop the
 * shared one working), what a scanned club card offers, and what a scanned
 * code means. Tested in __tests__/club-code.test.ts.
 */
import { isObj, num } from '../read';
import type { ClubCard, ClubCode } from '../types';
import { cleanClubCode, parseQrText } from './links';

/** kv: club id → the last code I made for it {code, codeExpiresAt}. Local only (src/sync/kv-keys.ts). */
export const CLUB_CODES_KEY = 'buddies.clubCodes';

export type SavedCodes = Record<string, ClubCode>;

/** A code with less than this left is made again rather than shown. */
const FRESH_MS = 30 * 60_000;

/** The saved codes as kept in kv; anything broken is left out. */
export function readSavedCodes(v: unknown): SavedCodes {
  const out: SavedCodes = {};
  if (!isObj(v)) return out;
  for (const [clubId, c] of Object.entries(v)) {
    if (!isObj(c) || typeof c.code !== 'string') continue;
    const code = cleanClubCode(c.code);
    const at = num(c.codeExpiresAt);
    if (code && at > 0) out[clubId] = { code, codeExpiresAt: at };
  }
  return out;
}

/** The code to show for this club: the saved one while it has 30 minutes or more left, else null (make a new one). */
export function liveCode(saved: SavedCodes, clubId: string, now: number): ClubCode | null {
  const c = saved[clubId];
  return c && c.codeExpiresAt - now >= FRESH_MS ? c : null;
}

/** The saved codes with this club's new one, and run-out ones dropped. */
export function withCode(saved: SavedCodes, clubId: string, code: ClubCode, now: number): SavedCodes {
  const out: SavedCodes = {};
  for (const [id, c] of Object.entries(saved)) if (id !== clubId && c.codeExpiresAt > now) out[id] = c;
  out[clubId] = code;
  return out;
}

/** What the scanned club's card offers me. */
export type CardAction = 'ask' | 'join' | 'asked' | 'open';

export function cardAction(card: Pick<ClubCard, 'myState'>): CardAction {
  switch (card.myState) {
    case 'member':
      return 'open';
    case 'invited':
      return 'join';
    case 'asked':
      return 'asked';
    default:
      return 'ask';
  }
}

/** The card's main button, or null when there is nothing to tap (I already asked). */
export function cardButton(a: CardAction): string | null {
  return a === 'open' ? 'Open club' : a === 'join' ? 'Join' : a === 'ask' ? 'Ask to join' : null;
}

/** What a scan means for me: a walker to look up, my own code, a club, or not a Steps code. */
export type ScanOutcome = { kind: 'walker'; handle: string } | { kind: 'self' } | { kind: 'club'; code: string } | { kind: 'other' };

export function scanOutcome(text: string | null | undefined, myHandle: string | null): ScanOutcome {
  const t = parseQrText(text);
  if (!t) return { kind: 'other' };
  if (t.kind === 'club') return t;
  if (myHandle && t.handle.toLowerCase() === myHandle.toLowerCase()) return { kind: 'self' };
  return t;
}

/** The plain words the scan screen shows for a scan it can't use (none for a walker or a club). */
export function scanMessage(o: ScanOutcome): string | null {
  if (o.kind === 'other') return "This isn't a Steps code. Scan a walker's or a club's QR code from Steps.";
  if (o.kind === 'self') return 'That is your own code. Ask your friend to show theirs.';
  return null;
}
