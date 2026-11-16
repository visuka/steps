/**
 * The app's one look: Calm and large (e.ts). The other seven looks (Clean+,
 * Park, Daylight, Night, Ink and saffron, Colour blocks, Sport data) were
 * archived on 17 Nov 2026 (owner): git branch archive/all-looks, tag
 * looks-archive-2026-11-17. A theme is one file here; see types.ts for what it holds.
 */

import e from './e';
import { DEFAULT_THEME_ID, type ThemeDef, type ThemeId } from './types';

export * from './types';

export const THEMES: readonly ThemeDef[] = [e];

const BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeDef>;

export function themeById(id: ThemeId): ThemeDef {
  return BY_ID[id] ?? BY_ID[DEFAULT_THEME_ID];
}

/** The theme in use: the one look. */
export function activeTheme(): ThemeDef {
  return themeById(DEFAULT_THEME_ID);
}
