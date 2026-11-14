/**
 * Every theme, in the order the Appearance picker shows them, and the one in
 * use. A theme is one file here; see types.ts for what it holds.
 */

import a from './a';
import b from './b';
import c from './c';
import { deviceStore, readThemeId, type ThemeStore } from './choice';
import d from './d';
import e from './e';
import f from './f';
import park from './park';
import { DEFAULT_THEME_ID, type ThemeDef, type ThemeId } from './types';

export * from './types';
export { isThemeId, readThemeId, THEME_KEY, THEME_NOTE_KEY, type ThemeStore, writeThemeId } from './choice';

export const THEMES: readonly ThemeDef[] = [park, a, b, c, d, e, f];

const BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeDef>;

export function themeById(id: ThemeId): ThemeDef {
  return BY_ID[id] ?? BY_ID[DEFAULT_THEME_ID];
}

/**
 * The ground a theme draws on for the phone's light or dark setting (a
 * one-scheme theme ignores it): the window colour behind the app while it
 * restarts into that theme.
 */
export function groundOf(t: ThemeDef, phone: 'light' | 'dark' | null | undefined): string {
  const scheme = t.mode === 'system' ? (phone === 'dark' ? 'dark' : 'light') : t.mode;
  return t.colors[scheme].surface;
}

/** The theme saved on this phone (read synchronously), or Colour blocks. */
export function activeTheme(store: ThemeStore | null = deviceStore()): ThemeDef {
  return themeById(readThemeId(store));
}
