import { describe, expect, it } from '@jest/globals';

import { Colors, type ColorScheme, contrast, Module, Spacing, type ThemeColor, TypeScale } from '../tokens';

const SCHEMES = Object.entries(Colors) as [string, ColorScheme][];
const SURFACES: ThemeColor[] = [
  'surface',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
];
const DATA: ThemeColor[] = ['steps', 'food', 'water', 'sleep', 'near', 'over'];

/** Text on its container: [text, background]. */
const TEXT_PAIRS: [ThemeColor, ThemeColor][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
  ['onBackground', 'background'],
  ['inverseOnSurface', 'inverseSurface'],
  ['inversePrimary', 'inverseSurface'],
  ['onStepsContainer', 'stepsContainer'],
  ['onFoodContainer', 'foodContainer'],
  ['onWaterContainer', 'waterContainer'],
  ['onSleepContainer', 'sleepContainer'],
  ['onNearContainer', 'nearContainer'],
  ['onSteps', 'steps'],
  ['onFood', 'food'],
  ['onWater', 'water'],
  ['onSleep', 'sleep'],
  ['onNear', 'near'],
  ['onOver', 'over'],
];

describe('colour roles', () => {
  it('light and dark define the same roles, all as #RRGGBB', () => {
    const keys = Object.keys(Colors.light).sort();
    expect(Object.keys(Colors.dark).sort()).toEqual(keys);
    for (const [, scheme] of SCHEMES) {
      for (const value of Object.values(scheme)) expect(value).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it.each(SCHEMES)('%s: body text and secondary text pass AA (4.5:1) on every surface', (_name, c) => {
    for (const bg of SURFACES) {
      expect(contrast(c.onSurface, c[bg])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onSurfaceVariant, c[bg])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.primary, c[bg])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SCHEMES)('%s: text on every container passes AA', (_name, c) => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect({ pair: `${fg} on ${bg}`, ok: contrast(c[fg], c[bg]) >= 4.5 }).toEqual({ pair: `${fg} on ${bg}`, ok: true });
    }
  });

  it.each(SCHEMES)('%s: outlines and data marks stand out 3:1 from every surface', (_name, c) => {
    for (const bg of SURFACES.slice(0, 4)) {
      expect(contrast(c.outline, c[bg])).toBeGreaterThanOrEqual(3);
      for (const d of DATA) expect(contrast(c[d], c[bg])).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(SCHEMES)('%s: the covered part of a track stands out from the empty lane', (_name, c) => {
    for (const d of DATA) expect(contrast(c[d], c.lane)).toBeGreaterThanOrEqual(3);
  });

  it.each(SCHEMES)('%s: the lane shows on cards, and ticks show on both parts of a track', (_name, c) => {
    for (const bg of SURFACES.slice(0, 4)) expect(contrast(c.lane, c[bg])).toBeGreaterThanOrEqual(1.25);
    expect(contrast(c.laneTick, c.lane)).toBeGreaterThanOrEqual(3);
    // Ticks over the covered part are painted in the tone's on colour.
    for (const [fill, on] of [
      ['steps', 'onSteps'],
      ['food', 'onFood'],
      ['water', 'onWater'],
      ['sleep', 'onSleep'],
      ['near', 'onNear'],
      ['over', 'onOver'],
    ] as [ThemeColor, ThemeColor][])
      expect(contrast(c[on], c[fill])).toBeGreaterThanOrEqual(3);
  });

  it.each(SCHEMES)('%s: the three food marks of a split bar each stand out 3:1 from the lane and cards', (_name, c) => {
    for (const mark of ['food', 'food2', 'food3'] as ThemeColor[]) {
      expect(contrast(c[mark], c.lane)).toBeGreaterThanOrEqual(3);
      for (const bg of SURFACES.slice(0, 4)) expect(contrast(c[mark], c[bg])).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the older names pointing at the new roles', () => {
    for (const [, c] of SCHEMES) {
      expect(c.text).toBe(c.onSurface);
      expect(c.textSecondary).toBe(c.onSurfaceVariant);
      expect(c.background).toBe(c.surface);
      expect(c.accent).toBe(c.steps);
      expect(c.danger).toBe(c.error);
      expect(c.track).toBe(c.lane);
    }
  });
});

describe('grid and type', () => {
  it('spacing steps above a hairline are on the 4 dp half-module', () => {
    for (const [key, v] of Object.entries(Spacing)) if (key !== 'half') expect(v % (Module / 2)).toBe(0);
  });

  it('big numerals sit on whole 8 dp modules', () => {
    for (const spec of Object.values(TypeScale)) {
      if ('numeral' in spec) {
        expect(spec.size % Module).toBe(0);
        expect(spec.line % Module).toBe(0);
      }
      expect(spec.line).toBeGreaterThanOrEqual(spec.size);
    }
  });
});
