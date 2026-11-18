/**
 * The app's one look, Plain (themes/e.ts, from the d38 tokens in themes/plain.ts). The other seven looks were
 * archived on 17 Nov 2026 (branch archive/all-looks), with their tests.
 */

import { describe, expect, it } from '@jest/globals';

import { activeTheme, DEFAULT_THEME_ID, THEME_IDS, themeById, THEMES } from '../themes';
import { buildControls, buildFonts, buildType, faceForWeight, fontMap, mapColorsOf, resolveColor } from '../themes/build';
import type { ColorRef } from '../themes/types';
import { contrast, TouchTarget, TYPE_ROLES } from '../tokens';

const calm = themeById('e');

describe('the one look', () => {
  it('is Plain, and it is what the app draws', () => {
    expect(THEME_IDS).toEqual(['e']);
    expect(THEMES).toEqual([calm]);
    expect(DEFAULT_THEME_ID).toBe('e');
    expect(calm.name).toBe('Plain');
    expect(activeTheme()).toBe(calm);
  });

  it('is light, the same with the phone in dark mode', () => {
    expect(calm.mode).toBe('light');
    expect(calm.colors.dark).toEqual(calm.colors.light);
  });

  // The font stub gives each export its own name, so this checks the file, not just the label.
  it('loads every face under its own file’s name', () => {
    // A bundled .ttf (the Outfit figures) has no export name to check; its file is named after the family.
    for (const [weight, face] of Object.entries(calm.fonts))
      if (typeof face.source === 'string') expect({ weight, family: face.family }).toEqual({ weight, family: face.source });
    for (const [family, source] of Object.entries(fontMap(calm))) if (typeof source === 'string') expect(source).toBe(family);
  });

  it('has its own map', () => {
    expect(calm.map).toBeDefined();
    expect(mapColorsOf(calm, 'light')).toBe(calm.map);
  });

  it('puts nothing in capitals except small labels', () => {
    for (const spec of [calm.style.overline, calm.style.kicker]) if (spec?.case === 'upper') expect(spec.size).toBeLessThanOrEqual(12);
    expect(calm.style.buttonCase ?? 'none').toBe('none');
    expect(calm.style.chipCase ?? 'none').toBe('none');
  });

  it('names a role or a #RRGGBB colour in every colour reference', () => {
    const roles = Object.keys(calm.colors.light);
    const s = calm.style;
    const refs = [
      s.outlined?.border,
      s.outlined?.fill,
      s.outlined?.ink,
      s.overline?.color,
      s.kicker?.color,
      s.segment?.well,
      s.segment?.wellBorder,
      s.segment?.selected,
      s.segment?.onSelected,
      s.segment?.selectedBorder,
      s.segment?.idle,
      s.segment?.divider,
      s.nav?.background,
      s.nav?.border,
      s.nav?.pill,
      s.nav?.onPill,
      s.nav?.active,
      s.nav?.idle,
    ].filter((r): r is ColorRef => typeof r === 'string' && r !== 'tone');
    for (const r of refs) expect({ r, ok: /^#[0-9A-F]{6}$/i.test(r) || roles.includes(r) }).toEqual({ r, ok: true });
  });

  it('keeps labels, segments, nav labels and button labels readable on their plates (4.5:1)', () => {
    const c = calm.colors.light;
    const at = (r: string) => resolveColor(c, r as ColorRef);
    const s = calm.style;
    const pairs: [string, string, string][] = [];
    for (const spec of [s.overline, s.kicker]) if (spec) pairs.push(['label', spec.color, 'surface']);
    if (s.segment) {
      pairs.push(['segment selected', s.segment.onSelected, s.segment.selected]);
      pairs.push(['segment idle', s.segment.idle, s.segment.well ?? 'surface']);
    }
    if (s.nav) {
      pairs.push(['nav active', s.nav.active, s.nav.background]);
      pairs.push(['nav idle', s.nav.idle, s.nav.background]);
    }
    if (s.outlined) pairs.push(['outlined', s.outlined.ink, s.outlined.fill ?? 'surface']);
    for (const [what, fg, bg] of pairs) expect({ what, ok: contrast(at(fg), at(bg)) >= 4.5 }).toEqual({ what, ok: true });
  });
});

describe('type built from the look', () => {
  it('builds words in Figtree and figures in Outfit, each at its size', () => {
    const fonts = buildFonts(calm, 'android');
    const type = buildType(calm, fonts);
    for (const role of TYPE_ROLES) {
      expect(type[role].fontSize).toBe(calm.type[role].size);
      expect(type[role].fontFamily).toMatch(calm.type[role].numeral ? /^Outfit_/ : /^Figtree_/);
    }
    expect(type.numeralHero.fontVariant).toEqual(['tabular-nums']);
  });

  it('adds the Noto fallback on the web, and leaves non-theme faces alone', () => {
    expect(buildFonts(calm, 'web').regular).toContain('Noto Sans Telugu');
    expect(faceForWeight(buildFonts(calm, 'android'), 'monospace', '700')).toBeNull();
  });

  it('leaves out tabular figures when turned off', () => {
    const plain = { ...calm, style: { ...calm.style, numeralTabular: false } };
    expect(buildType(plain, buildFonts(plain, 'android')).numeralHero.fontVariant).toBeUndefined();
  });
});

describe('button, chip and FAB shapes', () => {
  const c = buildControls(calm);

  it('draws 48 dp pill buttons, as the plain tiles', () => {
    expect(c.button.minHeight).toBe(48);
    expect(c.button.minHeight).toBeGreaterThanOrEqual(TouchTarget);
    expect(c.button.borderRadius).toBe(999);
    expect(c.action.minHeight).toBe(48);
    expect(c.fab.borderRadius).toBe(999);
  });

  it('keeps chips and buttons in sentence case and the FAB flat', () => {
    expect(c.buttonLabel).toEqual({});
    expect(c.chipLabel).toEqual({});
    expect(c.chipType).toBe('labelLarge');
    expect(c.fab.elevation).toBe(0);
    expect(c.fab.shadowOpacity).toBe(0);
  });

  it('raises a button height under the touch target to 48, and can draw labels in capitals', () => {
    const odd = { ...calm, style: { ...calm.style, buttonHeight: 40, buttonRadius: 8, buttonCase: 'upper' as const, fabShadow: false } };
    const o = buildControls(odd);
    expect(o.button).toEqual({ borderRadius: 8, minHeight: 48 });
    expect(o.buttonLabel).toEqual({ textTransform: 'uppercase' });
    expect(o.fab).toMatchObject({ elevation: 0, shadowOpacity: 0 });
  });
});
