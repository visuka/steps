/**
 * The design preview's link: which theme and which screen to draw over the
 * sample data, so CI can photograph every theme next to its mockup.
 *
 *   neutcraftssteps://design-preview?theme=e&screen=today
 *
 * theme: clean, park, a, b, c, d, e or f. screen: one of PREVIEW_SCREENS (food is the food result; foodtab is the Food screen).
 * Screens that read their own route params (activity's section, chat's key and title,
 * walker's pid, name and handle) take them from the same link.
 * Both are required and lower case; anything else is refused (the route says so
 * on screen rather than guess). The detail screen also takes kind (steps, active,
 * food, water or sleep; steps when missing or unknown):
 *
 *   neutcraftssteps://design-preview?theme=e&screen=detail&kind=water
 * The food screen also takes mine=1: the sample dish as the person's own version, with its Edit panel open (T15).
 * It also takes edit=1: the result opened for editing its ingredients (T15).
 *
 *   neutcraftssteps://design-preview?theme=e&screen=food&edit=1
 * The club screen also takes seg=chat|walks|goals|board (the tab it opens on), and the club
 * screens their id=<clubId> (design-preview/buddies-sample.ts), read by the screen itself.
 * The plan screen takes id=<planId> (PLN000000001: mine; PLN000000002: I'm invited), and
 * plan-new takes tips=1: the form with the safety tips sheet open over it (T16e); club takes
 * tips=1 too: the club's safety tips over the club.
 * QR invites: buddies-qr is Buddies with My QR open; qr-scan is the scanner (&code=K7QM2XPA:
 * a club's card, without the camera; &typing=1: the Enter a club code sheet open); club-admin
 * takes qr=1 (the Club QR open) and invite=1 (Invite a buddy open), and club-join
 * code=<code> (the goals consent for a club found by its code). Those screens read them themselves.
 * Shared goals: goal takes id=<clubId>&goalId=<goalId> (KBR000000001, GL0000000001), goal-new
 * id=<clubId> and goal=<goalId> to change one; club &seg=goals with id=HPW000000004 is a member's
 * tab and id=SRN000000005 the goal tracking switch. Those screens read them themselves.
 * plus-locked is Buddies as it is without Premium, over the sample clubs.
 * Choosing a new captain: club &id=GSW000000006 is a club voting (I'm a member, I stand and
 * voted), &id=KDP000000008 one whose vote closed (the new captain line), and &ask=leave
 * opens the Leave dialog (with &id=KBR000000001: the captain's). club-election takes
 * &id=GSW000000006 (candidates) or BGW000000007 (no one standing). Those screens read them themselves.
 * Every screen also takes part=dawn|noon|dusk: Today and the bar in that part's colours
 * instead of the clock's (T18).
 * Plain string work only: React Native's URLSearchParams has no get().
 */

import { type DayPart, isDayPart } from '@/constants/day-part';
import { THEME_IDS, type ThemeId } from '@/constants/themes/types';
import { parseKind, type SeriesKind } from '@/state/series';

/** The route's path, app/design-preview.tsx. */
export const PREVIEW_ROUTE = 'design-preview';

/** The mockup screens, in the mockups' order, then the hourly detail. */
export const PREVIEW_SCREENS = [
  'today',
  'food',
  'walk',
  'detail',
  'plus',
  'activity',
  'news',
  // The rest of the app, so CI can photograph every screen (17 Nov 2026):
  'you',
  'foodtab',
  'buddies',
  'settings',
  'insights',
  'stepcheck',
  'places',
  'record',
  'scan',
  'find',
  'requests',
  'chat',
  'walker',
  'signin',
  'welcome',
  // Clubs (T16f): search, the start form, a club, running it, and the goals consent.
  'clubs',
  'club-new',
  'club',
  'club-admin',
  'club-join',
  // Walk plans (T16e): a plan (&id=), and Plan a walk (&tips=1 with the safety tips).
  'plan',
  'plan-new',
  // QR invites: Buddies with My QR open, and the scanner (&code= opens a club's card without the camera).
  'buddies-qr',
  'qr-scan',
  // Shared club goals: one goal for the captain (&id=&goalId=), the goal form (&id=, &goal= to change one), and My goals.
  'goal',
  'goal-new',
  'my-goals',
  // Buddies without Premium: the premium card and Your clubs (Leave club, Stop goal tracking).
  'plus-locked',
  // Choosing a new captain: the election screen (&id=GSW000000006 I stand and voted; BGW000000007 no one standing).
  'club-election',
] as const;
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

/** The club screen's tabs, for &seg= on screen=club. */
export const CLUB_SEGS = ['chat', 'walks', 'goals', 'board'] as const;
export type ClubSeg = (typeof CLUB_SEGS)[number];

export interface PreviewParams {
  theme: ThemeId;
  screen: PreviewScreen;
  /** The detail screen's series; only set when screen is 'detail'. */
  kind?: SeriesKind;
  /** The food screen opened on its ingredient editor; only set when screen is 'food'. */
  edit?: boolean;
  /** The food screen showing the person's own version; only set when screen is 'food'. */
  mine?: boolean;
  /** Today and the bar in this part of the day's colours; the clock's when missing. */
  part?: DayPart;
  /** The club screen's tab; only set when screen is 'club' and the link names one. */
  seg?: ClubSeg;
  /** The safety tips sheet open; only set when screen is 'plan-new' (Plan a walk) or 'club' (a club's tips). */
  tips?: boolean;
}

/** Route params as expo-router hands them over (useLocalSearchParams). */
export type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The theme and screen, or null when either is missing or unknown. */
export function parsePreviewParams(raw: RawParams): PreviewParams | null {
  const theme = first(raw.theme);
  const screen = first(raw.screen);
  if (!(THEME_IDS as readonly (string | undefined)[]).includes(theme)) return null;
  if (!(PREVIEW_SCREENS as readonly (string | undefined)[]).includes(screen)) return null;
  const rawPart = first(raw.part);
  const part = isDayPart(rawPart) ? { part: rawPart } : {};
  if (screen === 'detail') return { theme: theme as ThemeId, screen, kind: parseKind(raw.kind) ?? 'steps', ...part };
  if (screen === 'food' && first(raw.mine) === '1') return { theme: theme as ThemeId, screen, mine: true, ...part };
  if (screen === 'food' && first(raw.edit) === '1') return { theme: theme as ThemeId, screen, edit: true, ...part };
  if (screen === 'plan-new' && first(raw.tips) === '1') return { theme: theme as ThemeId, screen, tips: true, ...part };
  const seg = first(raw.seg);
  const clubTips = screen === 'club' && first(raw.tips) === '1' ? { tips: true } : {};
  if (screen === 'club' && (CLUB_SEGS as readonly (string | undefined)[]).includes(seg)) return { theme: theme as ThemeId, screen, seg: seg as ClubSeg, ...clubTips, ...part };
  return { theme: theme as ThemeId, screen: screen as PreviewScreen, ...clubTips, ...part };
}

/** The link that opens the preview, e.g. neutcraftssteps://design-preview?theme=e&screen=today. */
export function previewUrl(scheme: string, p: PreviewParams): string {
  const kind = p.screen === 'detail' && p.kind ? `&kind=${p.kind}` : '';
  const edit = p.screen === 'food' ? (p.mine ? '&mine=1' : p.edit ? '&edit=1' : '') : '';
  const part = p.part ? `&part=${p.part}` : '';
  const seg = p.screen === 'club' && p.seg ? `&seg=${p.seg}` : '';
  const tips = (p.screen === 'plan-new' || p.screen === 'club') && p.tips ? '&tips=1' : '';
  return `${scheme}://${PREVIEW_ROUTE}?theme=${p.theme}&screen=${p.screen}${kind}${edit}${seg}${tips}${part}`;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

/**
 * The preview a launch link asks for, or null for any other link (or none).
 * Takes `<scheme>://design-preview?…`, `<scheme>:///design-preview?…` and the
 * development client's `exp://host:port/--/design-preview?…`.
 */
export function parsePreviewUrl(url: string | null | undefined): PreviewParams | null {
  if (!url) return null;
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^?#]*)(?:\?([^#]*))?/i.exec(url.trim());
  if (!match) return null;
  const segments = match[1].split('/').filter(Boolean);
  const dev = segments.indexOf('--');
  const path = dev >= 0 ? segments.slice(dev + 1) : segments;
  if (path.length !== 1 || path[0] !== PREVIEW_ROUTE) return null;
  const raw: RawParams = {};
  for (const pair of (match[2] ?? '').split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    if (!(key in raw)) raw[key] = decode(eq < 0 ? '' : pair.slice(eq + 1));
  }
  return parsePreviewParams(raw);
}
