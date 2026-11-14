/**
 * Switching theme. Fonts, type and shapes are baked into every StyleSheet at
 * import, so a new theme needs a fresh start of the JavaScript: the choice is
 * saved, then the app reloads its own bundle with expo's reloadAppAsync()
 * (expo-modules-core; works in release builds, reloads the React host on
 * Android, and the page on the web). No update is fetched.
 */

import { reloadAppAsync } from 'expo';
import * as Font from 'expo-font';
import * as SystemUI from 'expo-system-ui';

import { deviceStore, writeThemeId } from './choice';
import { fontMap } from './build';
import { groundOf, themeById, THEMES } from './index';
import type { ThemeId } from './types';

/** How long to wait for the reload to take the JavaScript away before saying it didn't. */
const RELOAD_WAIT_MS = 2000;

/**
 * - 'failed': the choice couldn't be saved; nothing changed.
 * - 'reopen': saved, but the app is still running after the reload (Android
 *   can skip it, and it fails on some hosts): it applies on the next start.
 * When the reload happens this never resolves, as the JavaScript is gone.
 */
export type ApplyResult = 'failed' | 'reopen';

/** Saves the theme and restarts the app in it. */
export async function applyTheme(id: ThemeId): Promise<ApplyResult> {
  if (!writeThemeId(deviceStore(), id)) return 'failed';
  // Until the new run draws, the window shows through: give it the new theme's ground now.
  await SystemUI.setBackgroundColorAsync(groundOf(themeById(id))).catch(() => undefined);
  try {
    await reloadAppAsync(`Theme changed to ${id}`);
  } catch {
    return 'reopen';
  }
  await new Promise((resolve) => setTimeout(resolve, RELOAD_WAIT_MS));
  return 'reopen';
}

/**
 * The faces the Appearance picker previews (each theme's numeral and UI
 * semibold), loaded quietly after start-up so the picker draws each name and
 * number in its own font. Failures are ignored: the preview falls back to the
 * system font.
 */
export function loadPreviewFonts(): Promise<void> {
  const map: Record<string, number | string> = {};
  for (const t of THEMES) {
    const all = fontMap(t);
    for (const face of [t.fonts.numeral, t.fonts.semibold]) map[face.family] = all[face.family];
  }
  return Font.loadAsync(map).catch(() => undefined);
}
