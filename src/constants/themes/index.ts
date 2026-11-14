/**
 * Every theme, in the order the Appearance picker shows them, and the one in
 * use. A theme is one file here; see types.ts for what it holds.
 */

import a from './a';
import b from './b';
import c from './c';
import clean from './clean';
import { deviceStore, readThemeId, type ThemeStore } from './choice';
import d from './d';
import e from './e';
import f from './f';
import park from './park';
import { previewLaunch } from '@/design-preview/launch';
import { DEFAULT_THEME_ID, type ThemeDef, type ThemeId } from './types';

export * from './types';
export { isThemeId, readThemeId, THEME_KEY, THEME_NOTE_KEY, type ThemeStore, writeThemeId } from './choice';

export const THEMES: readonly ThemeDef[] = [clean, park, a, b, c, d, e, f];

const BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeDef>;

export function themeById(id: ThemeId): ThemeDef {
  return BY_ID[id] ?? BY_ID[DEFAULT_THEME_ID];
}

/**
 * The ground a theme draws on: the window colour behind the app while it
 * restarts into that theme. Every theme keeps one scheme, so the phone's
 * light or dark setting does not matter.
 */
export function groundOf(t: ThemeDef): string {
  return t.colors[t.mode].surface;
}

/**
 * The theme saved on this phone (read synchronously), or Clean+. A run
 * started by the design preview's link draws in the link's theme instead,
 * and nothing is saved (design-preview/launch.ts).
 */
export function activeTheme(
  store: ThemeStore | null = deviceStore(),
  preview: ThemeId | null = previewLaunch()?.theme ?? null,
): ThemeDef {
  return themeById(preview ?? readThemeId(store));
}
