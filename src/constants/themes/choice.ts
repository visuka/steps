/**
 * The chosen theme, kept on the phone and read synchronously at start-up, so
 * theme.ts can build the fonts, type and shapes of that theme before any
 * screen's StyleSheet.create runs.
 *
 * The store is expo-sqlite's key-value store (getItemSync / setItemSync). It
 * is required lazily, so jest and the web preview fall back to the default
 * theme when it is not there.
 */

import { previewLaunch } from '@/design-preview/launch';

import { DEFAULT_THEME_ID, THEME_IDS, type ThemeId } from './types';

export const THEME_KEY = 'appearance.theme';
/** Set once the one-time "new look" note on Today has been seen or closed. */
export const THEME_NOTE_KEY = 'appearance.noteSeen';

/** The part of expo-sqlite/kv-store the theme uses. */
export interface ThemeStore {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): void;
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

/** The saved theme, or the default when nothing (or something unknown) is saved. Never throws. */
export function readThemeId(store: ThemeStore | null): ThemeId {
  try {
    const saved = store?.getItemSync(THEME_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

/** Saves the choice; false when it could not be saved. */
export function writeThemeId(store: ThemeStore | null, id: ThemeId): boolean {
  if (!store || !isThemeId(id)) return false;
  try {
    store.setItemSync(THEME_KEY, id);
    return true;
  } catch {
    return false;
  }
}

let device: ThemeStore | null | undefined;

/**
 * The phone's key-value store, or null where there is none (jest, a web
 * preview without SQLite) and in a design-preview run, which must never read
 * or save the person's choices (design-preview/launch.ts).
 */
export function deviceStore(): ThemeStore | null {
  if (device !== undefined) return device;
  if (previewLaunch()) {
    device = null;
    return device;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const kv = require('expo-sqlite/kv-store') as { default: ThemeStore };
    device = kv.default ?? null;
  } catch {
    device = null;
  }
  return device;
}
