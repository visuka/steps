/**
 * The design preview's link: which theme and which screen to draw over the
 * sample data, so CI can photograph every theme next to its mockup.
 *
 *   neutcraftssteps://design-preview?theme=d&screen=today
 *
 * theme: clean, park, a, b, c, d, e or f. screen: today, food, walk or detail.
 * Both are required and lower case; anything else is refused (the route says so
 * on screen rather than guess). The detail screen also takes kind (steps, active,
 * food, water or sleep; steps when missing or unknown):
 *
 *   neutcraftssteps://design-preview?theme=clean&screen=detail&kind=water
 * Plain string work only: React Native's URLSearchParams has no get().
 */

import { THEME_IDS, type ThemeId } from '@/constants/themes/types';
import { parseKind, type SeriesKind } from '@/state/series';

/** The route's path, app/design-preview.tsx. */
export const PREVIEW_ROUTE = 'design-preview';

/** The mockup screens, in the mockups' order, then the hourly detail. */
export const PREVIEW_SCREENS = ['today', 'food', 'walk', 'detail'] as const;
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

export interface PreviewParams {
  theme: ThemeId;
  screen: PreviewScreen;
  /** The detail screen's series; only set when screen is 'detail'. */
  kind?: SeriesKind;
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
  if (screen === 'detail') return { theme: theme as ThemeId, screen, kind: parseKind(raw.kind) ?? 'steps' };
  return { theme: theme as ThemeId, screen: screen as PreviewScreen };
}

/** The link that opens the preview, e.g. neutcraftssteps://design-preview?theme=d&screen=today. */
export function previewUrl(scheme: string, p: PreviewParams): string {
  const kind = p.screen === 'detail' && p.kind ? `&kind=${p.kind}` : '';
  return `${scheme}://${PREVIEW_ROUTE}?theme=${p.theme}&screen=${p.screen}${kind}`;
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
