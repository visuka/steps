import { describe, expect, it } from '@jest/globals';

import { Colors } from '../tokens';

// app.json can't hold comments: this test keeps its launch colours on the tokens.
const app = require('../../../app.json') as { expo: { android: { adaptiveIcon: { backgroundColor: string } }; plugins: unknown[] } };

function plugin(name: string): Record<string, unknown> {
  const entry = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>] | undefined;
  if (!entry) throw new Error(`${name} is not configured`);
  return entry[1];
}

describe('launch colours in app.json', () => {
  it('splash uses the surface of each scheme', () => {
    const splash = plugin('expo-splash-screen') as { backgroundColor: string; dark: { backgroundColor: string } };
    expect(splash.backgroundColor).toBe(Colors.light.surface);
    expect(splash.dark.backgroundColor).toBe(Colors.dark.surface);
  });

  it('notification accent is the steps colour', () => {
    expect(plugin('expo-notifications').color).toBe(Colors.light.steps);
  });

  it('adaptive icon background is the light surface', () => {
    expect(app.expo.android.adaptiveIcon.backgroundColor).toBe(Colors.light.surface);
  });
});
