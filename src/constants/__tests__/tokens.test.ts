import { describe, expect, it } from '@jest/globals';

import { tileColors } from '../../components/ui/tile-colors';
import { THEMES } from '../themes';
import park from '../themes/park';
import { type ColorScheme, contrast, Module, Spacing, type ThemeColor, TYPE_ROLES } from '../tokens';

/** Every theme in both schemes, e.g. "d light". A dark-only theme is checked twice; that's fine. */
const SCHEMES = THEMES.flatMap((t) =>
  (['light', 'dark'] as const).map((s) => [`${t.id} ${s}`, t.colors[s]] as [string, ColorScheme]),
);
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
  it('every scheme of every theme defines the same roles, all as #RRGGBB', () => {
    const keys = Object.keys(park.colors.light).sort();
    for (const [name, scheme] of SCHEMES) {
      expect({ name, keys: Object.keys(scheme).sort() }).toEqual({ name, keys });
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

  it.each(SCHEMES)('%s: a stat tile’s number, label, unit and note pass AA on its plate, selected or not', (_name, c) => {
    for (const look of ['filled', 'outlined', 'plain'] as const)
      for (const tone of [undefined, 'steps', 'food', 'water', 'sleep'] as const)
        for (const selected of [false, true]) {
          const t = tileColors(c, look, tone, selected);
          const at = `${look} ${tone ?? 'untoned'}${selected ? ' selected' : ''}`;
          expect({ at, text: contrast(t.text, t.plate) >= 4.5, quiet: contrast(t.quiet, t.plate) >= 4.5 }).toEqual({
            at,
            text: true,
            quiet: true,
          });
        }
  });

  it.each(SCHEMES)('%s: text stays readable on the text-selection highlight', (_name, c) => {
    expect(contrast(c.onSurface, c.primaryContainer)).toBeGreaterThanOrEqual(4.5);
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
    // Inside a filled block the lane is the surface colour; its ticks still read.
    expect(contrast(c.laneTick, c.surface)).toBeGreaterThanOrEqual(3);
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

  it.each(SCHEMES)('%s: on a filled tile, its ink reads on the ground-coloured button and bar lane', (_name, c) => {
    for (const ink of ['onStepsContainer', 'onFoodContainer', 'onWaterContainer', 'onSleepContainer', 'onNearContainer'] as ThemeColor[])
      expect({ ink, ok: contrast(c[ink], c.surface) >= 4.5 }).toEqual({ ink, ok: true });
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

  it('park: big numerals sit on whole 8 dp modules', () => {
    for (const spec of Object.values(park.type)) {
      if (spec.numeral) {
        expect(spec.size % Module).toBe(0);
        expect(spec.line % Module).toBe(0);
      }
    }
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s: every type role is set, lines clear their size, numerals on the 4 dp half-module', (_id, t) => {
    expect(Object.keys(t.type).sort()).toEqual([...TYPE_ROLES].sort());
    for (const role of TYPE_ROLES) {
      const spec = t.type[role];
      expect({ role, ok: spec.line >= spec.size && spec.size >= 11 }).toEqual({ role, ok: true });
      if (spec.numeral) expect(spec.line % (Module / 2)).toBe(0);
    }
  });
});
