import { describe, expect, it } from '@jest/globals';

import { DEFAULT_THEME_ID, themeById } from '../themes';

// app.json can't hold comments: this test keeps its launch colours on the tokens.
// The native splash is drawn before any theme loads: it takes the look's own
// ground (Calm and large's parchment). The icon and notification accent are the
// brand's green, kept from the first look (Park) when the looks were archived.
const BRAND = { surface: '#F4F6F0', steps: '#2B7A36' };
const Default = themeById(DEFAULT_THEME_ID).colors;
const app = require('../../../app.json') as { expo: { android: { adaptiveIcon: { backgroundColor: string } }; plugins: unknown[] } };

function plugin(name: string): Record<string, unknown> {
  const entry = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>] | undefined;
  if (!entry) throw new Error(`${name} is not configured`);
  return entry[1];
}

describe('launch colours in app.json', () => {
  it('native parts never follow the phone: light before the theme loads (the layout sets the theme\u2019s own)', () => {
    expect((app.expo as unknown as { userInterfaceStyle: string }).userInterfaceStyle).toBe('light');
  });

  it('splash uses the default theme’s surface in each scheme', () => {
    const splash = plugin('expo-splash-screen') as { backgroundColor: string; dark: { backgroundColor: string } };
    expect(splash.backgroundColor).toBe(Default.light.surface);
    expect(splash.dark.backgroundColor).toBe(Default.dark.surface);
  });

  it('notification accent is the steps colour', () => {
    expect(plugin('expo-notifications').color).toBe(BRAND.steps);
  });

  it('adaptive icon background is the light surface', () => {
    expect(app.expo.android.adaptiveIcon.backgroundColor).toBe(BRAND.surface);
  });
});
