/**
 * What a Steps QR code holds, and reading one back (the goals and club-code
 * contract): a walker is "neutcraftssteps://w/<handle>", a club is
 * "neutcraftssteps://c/<CODE>". Never a place, steps, a name or a token.
 * The same links open the app (app/w/[handle].tsx, app/c/[code].tsx). Pure,
 * tested in __tests__/links.test.ts.
 */
import { cleanHandle, handleProblem } from '../chat-logic';

/** The app's link scheme (app.json "scheme"). */
export const APP_SCHEME = 'neutcraftssteps';

/** A club join code: 8 characters of Crockford base32 (no I, L, O or U), as the family code. */
const CLUB_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export type QrTarget = { kind: 'walker'; handle: string } | { kind: 'club'; code: string };

export const walkerLink = (handle: string) => `${APP_SCHEME}://w/${cleanHandle(handle)}`;
export const clubLink = (code: string) => `${APP_SCHEME}://c/${code}`;

/**
 * A typed or scanned club code with spaces, dashes and case dropped, and the
 * look-alike letters read as the server reads them (family.clean_code: I and L
 * are 1, O is 0, U is V); null when it isn't one.
 */
export function cleanClubCode(raw: string): string | null {
  const code = raw
    .replace(/[\s-]+/g, '')
    .toUpperCase()
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
  return CLUB_CODE.test(code) ? code : null;
}

/** "K7QM 2XPA": easier to read out. */
export function spacedCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/** A walker ID from a link, or null when it isn't a valid one. */
export function linkHandle(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let h: string;
  try {
    h = cleanHandle(decodeURIComponent(raw));
  } catch {
    return null;
  }
  return handleProblem(h) ? null : h;
}

const LINK = new RegExp(`^${APP_SCHEME}:\\/\\/\\/?([wc])\\/([^/?#\\s]+)\\/?$`, 'i');

/**
 * What a scanned QR code points to, or null for any other code (a web link, a
 * payment code, a broken Steps link): the scan screen then says so in plain words.
 */
export function parseQrText(text: string | null | undefined): QrTarget | null {
  if (!text) return null;
  const m = LINK.exec(text.trim());
  if (!m) return null;
  if (m[1].toLowerCase() === 'w') {
    const handle = linkHandle(m[2]);
    return handle ? { kind: 'walker', handle } : null;
  }
  const code = cleanClubCode(m[2]);
  return code ? { kind: 'club', code } : null;
}

/** The share sheet's words for my walker ID (the QR sheet's Share). */
export const walkerShareText = (handle: string) => `Add me on Steps: @${cleanHandle(handle)}`;

/** The share sheet's words for a club code: the link opens the app, the code can be typed in Scan. */
export const clubShareText = (clubName: string, code: string) =>
  `Join ${clubName} on Steps: ${clubLink(code)} (code ${spacedCode(code)}, works for 48 hours)`;
