import { describe, expect, it } from '@jest/globals';

import {
  activeTheme,
  DEFAULT_THEME_ID,
  groundOf,
  readThemeId,
  THEME_IDS,
  THEME_KEY,
  themeById,
  THEMES,
  type ThemeStore,
  writeThemeId,
} from '../themes';
import {
  buildControls,
  buildFonts,
  buildType,
  faceForWeight,
  fontMap,
  mapColorsOf,
  numeralFontOf,
  resolveColor,
  uiFontOf,
} from '../themes/build';
import { CLEAN_OFF_SPEC } from '../themes/clean';
import { CLEAN_SPEC } from '../themes/clean-spec';
import type { ColorRef } from '../themes/types';
import { contrast, TouchTarget, TYPE_ROLES } from '../tokens';

/** An in-memory stand-in for expo-sqlite/kv-store. */
function memoryStore(initial: Record<string, string> = {}): ThemeStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItemSync: (key) => data[key] ?? null,
    setItemSync: (key, value) => {
      data[key] = value as string;
    },
  };
}

const broken: ThemeStore = {
  getItemSync: () => {
    throw new Error('no database');
  },
  setItemSync: () => {
    throw new Error('no database');
  },
};

describe('theme registry', () => {
  it('lists clean, park, a, b, c, d, e, f in that order, each once', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['clean', 'park', 'a', 'b', 'c', 'd', 'e', 'f']);
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
  });

  it('defaults to Clean+, and the other looks stay selectable', () => {
    expect(DEFAULT_THEME_ID).toBe('clean');
    expect(themeById('clean').name).toBe('Clean+');
    expect(themeById('d').name).toBe('Colour blocks');
    expect(THEME_IDS).toHaveLength(8);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s is complete', (_id, t) => {
    expect(t.name.length).toBeGreaterThan(0);
    expect(t.description.length).toBeGreaterThan(0);
    expect(['light', 'dark']).toContain(t.mode);
    for (const face of Object.values(t.fonts)) {
      expect(face.family).toMatch(/^[A-Za-z]+_\d{3}[A-Za-z]+$/);
      expect(face.source).toBeDefined();
    }
    expect(Object.keys(t.type).sort()).toEqual([...TYPE_ROLES].sort());
    for (const k of ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full'] as const) expect(typeof t.radius[k]).toBe('number');
    expect(['filled', 'outlined', 'plain']).toContain(t.style.tile);
    expect(['track', 'ring', 'bar', 'block']).toContain(t.style.hero);
    expect(['ticked', 'solid', 'segmented']).toContain(t.style.bar);
    expect(['neutral', 'tone']).toContain(t.style.navIndicator);
    expect(typeof t.style.numeralTabular).toBe('boolean');
  });

  it('the window behind a restart takes the new theme\u2019s ground, whatever the phone says', () => {
    expect(groundOf(themeById('clean'))).toBe('#FFFFFF');
    expect(groundOf(themeById('d'))).toBe('#FFFFFF');
    // Night is dark only.
    expect(groundOf(themeById('b'))).toBe(themeById('b').colors.dark.surface);
    for (const t of THEMES) expect(groundOf(t)).toBe(t.colors[t.mode].surface);
  });

  it('a one-scheme theme gives that scheme as both light and dark', () => {
    for (const t of THEMES) {
      if (t.mode === 'dark') expect(t.colors.light).toEqual(t.colors.dark);
      if (t.mode === 'light') expect(t.colors.dark).toEqual(t.colors.light);
    }
  });

  // The font stub gives each export its own name, so this checks the file, not just the label.
  it.each(THEMES.map((t) => [t.id, t] as const))('%s: every face is loaded under its own file�s name', (_id, t) => {
    for (const [weight, face] of Object.entries(t.fonts))
      expect({ weight, family: face.family }).toEqual({ weight, family: face.source });
  });

  it('two themes never load different files under one family name', () => {
    const seen = new Map<string, unknown>();
    for (const t of THEMES)
      for (const [family, source] of Object.entries(fontMap(t))) {
        if (seen.has(family)) expect(seen.get(family)).toBe(source);
        seen.set(family, source);
      }
  });
});

describe('mockup looks', () => {
  it('Clean+, Park, A, C, D, E and F are light, B is dark; none follows the phone', () => {
    for (const id of ['clean', 'park', 'a', 'c', 'd', 'e', 'f'] as const) {
      expect(themeById(id).mode).toBe('light');
      expect(themeById(id).colors.dark).toEqual(themeById(id).colors.light);
    }
    expect(themeById('b').mode).toBe('dark');
    expect(themeById('b').colors.light).toEqual(themeById('b').colors.dark);
  });

  it('every look except Park has its map', () => {
    for (const id of ['clean', 'a', 'b', 'c', 'd', 'e', 'f'] as const) {
      const t = themeById(id);
      expect(t.map).toBeDefined();
      expect(mapColorsOf(t, 'light')).toBe(t.map);
    }
    // Park has no map of its own: the OpenFreeMap light style, since it is light only.
    expect(mapColorsOf(themeById('park'), 'light').base).toBe('light');
  });

  it('nothing is in capitals except small labels', () => {
    for (const t of THEMES) {
      for (const spec of [t.style.overline, t.style.kicker]) if (spec?.case === 'upper') expect(spec.size).toBeLessThanOrEqual(12);
      expect(t.style.buttonCase ?? 'none').toBe('none');
      expect(t.style.chipCase ?? 'none').toBe('none');
    }
  });

  it('colour references name a role or a #RRGGBB colour', () => {
    const roles = Object.keys(themeById('park').colors.light);
    for (const t of THEMES) {
      const s = t.style;
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
      for (const r of refs) expect({ id: t.id, r, ok: /^#[0-9A-F]{6}$/i.test(r) || roles.includes(r) }).toEqual({ id: t.id, r, ok: true });
    }
  });

  it('labels, segments, nav labels and button labels read on their plates (4.5:1)', () => {
    for (const t of THEMES) {
      const c = t.colors.light;
      const at = (r: string) => resolveColor(c, r as ColorRef);
      const s = t.style;
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
      if (s.filledRole === 'tertiary') pairs.push(['filled', 'onTertiary', 'tertiary']);
      for (const [what, fg, bg] of pairs)
        expect({ id: t.id, what, ok: contrast(at(fg), at(bg)) >= 4.5 }).toEqual({ id: t.id, what, ok: true });
    }
  });

  it("F's dark block: text 4.5:1, marks 3:1, the mark apart from its lane", () => {
    const b = themeById('f').block!;
    for (const fg of [b.text, b.quiet]) expect(contrast(fg, b.plate)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(b.onChip, b.chip)).toBeGreaterThanOrEqual(4.5);
    for (const m of [b.mark, b.mark2, b.mark3, b.barHigh, b.barLow, b.average]) expect(contrast(m, b.plate)).toBeGreaterThanOrEqual(3);
    expect(contrast(b.mark, b.lane)).toBeGreaterThanOrEqual(3);
  });
});

describe('saved choice', () => {
  it('reads Clean+ when nothing is saved, the store is missing, or it fails', () => {
    expect(readThemeId(memoryStore())).toBe('clean');
    expect(readThemeId(null)).toBe('clean');
    expect(readThemeId(broken)).toBe('clean');
  });

  it('an unknown saved id loads Clean+; a saved look is kept', () => {
    expect(readThemeId(memoryStore({ [THEME_KEY]: 'neon' }))).toBe('clean');
    expect(activeTheme(memoryStore({ [THEME_KEY]: 'neon' })).id).toBe('clean');
    for (const id of ['park', 'a', 'b', 'c', 'd', 'e', 'f'] as const) {
      expect(readThemeId(memoryStore({ [THEME_KEY]: id }))).toBe(id);
      expect(activeTheme(memoryStore({ [THEME_KEY]: id })).id).toBe(id);
    }
  });

  it('writes and reads back each theme', () => {
    const store = memoryStore();
    for (const id of THEME_IDS) {
      expect(writeThemeId(store, id)).toBe(true);
      expect(store.data[THEME_KEY]).toBe(id);
      expect(readThemeId(store)).toBe(id);
      expect(activeTheme(store).id).toBe(id);
    }
  });

  it('reports a failed write', () => {
    expect(writeThemeId(null, 'park')).toBe(false);
    expect(writeThemeId(broken, 'park')).toBe(false);
  });
});

describe('type built from the active theme', () => {
  it('uses the saved theme’s faces and sizes', () => {
    const d = activeTheme(memoryStore({ [THEME_KEY]: 'd' }));
    const fonts = buildFonts(d, 'android');
    const type = buildType(d, fonts);
    expect(type.bodyLarge.fontFamily).toBe('PlusJakartaSans_500Medium');
    expect(type.labelLarge.fontFamily).toBe('PlusJakartaSans_800ExtraBold');
    expect(type.numeralHero).toMatchObject({ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 48, lineHeight: 52 });
    expect(type.numeralHero.fontVariant).toEqual(['tabular-nums']);

    const park = activeTheme(memoryStore({ [THEME_KEY]: 'park' }));
    const parkType = buildType(park, buildFonts(park, 'android'));
    expect(parkType.bodyLarge.fontFamily).toBe('Barlow_400Regular');
    expect(parkType.numeralHero).toMatchObject({ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 72 });
  });

  it('builds every role for every theme', () => {
    for (const t of THEMES) {
      const type = buildType(t, buildFonts(t, 'android'));
      for (const role of TYPE_ROLES) {
        expect(type[role].fontSize).toBe(t.type[role].size);
        expect(type[role].fontFamily).toBeTruthy();
      }
    }
  });

  it('maps CSS weights to the theme files and adds the Noto fallback on the web', () => {
    const d = themeById('d');
    const fonts = buildFonts(d, 'android');
    expect(uiFontOf(fonts, '700')).toBe('PlusJakartaSans_800ExtraBold');
    expect(uiFontOf(fonts, 600)).toBe('PlusJakartaSans_700Bold');
    expect(numeralFontOf(fonts, '500')).toBe('PlusJakartaSans_700Bold');
    expect(buildFonts(d, 'web').regular).toContain('Noto Sans Telugu');
  });

  it('C sets its titles in Fraunces and keeps every UI weight in Inter', () => {
    const c = themeById('c');
    const fonts = buildFonts(c, 'android');
    const type = buildType(c, fonts);
    for (const role of ['displayLarge', 'headlineSmall', 'titleLarge'] as const) {
      expect(type[role].fontFamily).toBe('Fraunces_600SemiBold');
      expect(type[role].fontVariant).toBeUndefined();
    }
    expect(type.titleMedium.fontFamily).toBe('Inter_600SemiBold');
    for (const w of ['700', 800, 'bold'] as const) expect(uiFontOf(fonts, w)).toMatch(/^Inter_/);
    // The navigation bar's active label: labelSmall with fontWeight 700.
    expect(faceForWeight(fonts, type.labelSmall.fontFamily, '700')).toBe('Inter_600SemiBold');
    // A heading with a weight override stays in Fraunces.
    expect(faceForWeight(fonts, type.titleLarge.fontFamily, '700')).toBe('Fraunces_600SemiBold');
  });

  it('a weight override on UI text picks UI weights even when the file is also a numeral weight', () => {
    const a = themeById('a');
    const fonts = buildFonts(a, 'android');
    const type = buildType(a, fonts);
    // A's Inter 600 is both its semibold and numeralMedium.
    expect(fonts.semibold).toBe(fonts.numeralMedium);
    expect(faceForWeight(fonts, type.labelMedium.fontFamily, '500')).toBe('Inter_500Medium');
    expect(faceForWeight(fonts, type.labelMedium.fontFamily, '400')).toBe('Inter_400Regular');
    // A numeral role keeps the numeral weights.
    expect(faceForWeight(fonts, type.numeralMedium.fontFamily, '500', true)).toBe(fonts.numeralMedium);
    expect(faceForWeight(fonts, type.numeralMedium.fontFamily, '700', true)).toBe(fonts.numeral);
    // Not a theme face: left alone.
    expect(faceForWeight(fonts, 'monospace', '700')).toBeNull();
  });

  it('leaves out tabular figures when a theme turns them off', () => {
    const d = themeById('d');
    const plain = { ...d, style: { ...d.style, numeralTabular: false } };
    expect(buildType(plain, buildFonts(plain, 'android')).numeralHero.fontVariant).toBeUndefined();
  });
});

describe('button, chip and FAB shapes', () => {
  const controls = (id: (typeof THEME_IDS)[number]) => buildControls(themeById(id));

  it.each(THEMES.map((t) => [t.id, t] as const))('%s keeps buttons at least 48 dp and its options valid', (_id, t) => {
    const c = buildControls(t);
    expect(c.button.minHeight).toBeGreaterThanOrEqual(TouchTarget);
    expect(c.button.borderRadius).toBeGreaterThanOrEqual(0);
    expect(c.iconMark.borderRadius).toBeLessThanOrEqual(20);
    expect(c.fab.borderRadius).toBeGreaterThanOrEqual(0);
    for (const k of ['buttonCase', 'chipCase'] as const) {
      if (t.style[k] !== undefined) expect(['none', 'upper']).toContain(t.style[k]);
    }
  });

  it('park is unchanged: pill buttons 48 dp, labels as written, FAB at radius.lg with its shadow', () => {
    const park = themeById('park');
    const c = controls('park');
    expect(c.button).toEqual({ borderRadius: park.radius.full, minHeight: 48 });
    expect(c.buttonLabel).toEqual({});
    expect(c.iconMark).toEqual({ borderRadius: 20 });
    expect(c.chipType).toBe('labelLarge');
    expect(c.chipLabel).toEqual({});
    expect(c.fab).toEqual({
      borderRadius: park.radius.lg,
      elevation: 3,
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    });
  });

  it('matches each mockup: pills for A, B and D; 12 dp for C and F; 20 dp for E', () => {
    for (const id of ['a', 'b', 'd'] as const) {
      expect(controls(id).button.borderRadius).toBe(999);
      expect(controls(id).iconMark.borderRadius).toBe(20);
      expect(controls(id).fab.borderRadius).toBe(28);
    }
    for (const id of ['c', 'f'] as const) {
      expect(controls(id).button.borderRadius).toBe(12);
      expect(controls(id).iconMark.borderRadius).toBe(12);
      expect(controls(id).fab.borderRadius).toBe(12);
    }
    expect(controls('e').button.borderRadius).toBe(20);
    expect(controls('e').fab.borderRadius).toBe(20);
  });

  it('E draws 56 dp buttons, the others 48', () => {
    expect(controls('e').button.minHeight).toBe(56);
    for (const id of ['park', 'a', 'b', 'c', 'd', 'f'] as const) expect(controls(id).button.minHeight).toBe(48);
  });

  it('chips and buttons keep sentence case everywhere, as drawn', () => {
    for (const t of THEMES) {
      expect(buildControls(t).buttonLabel).toEqual({});
      expect(buildControls(t).chipLabel).toEqual({});
      expect(buildControls(t).chipType).toBe('labelLarge');
    }
  });

  it('the mockup themes draw 56 dp main action buttons', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f'] as const) expect(controls(id).action.minHeight).toBe(56);
    expect(controls('park').action.minHeight).toBe(48);
  });

  it('the mockup themes draw a flat FAB', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      expect(controls(id).fab.elevation).toBe(0);
      expect(controls(id).fab.shadowOpacity).toBe(0);
    }
  });

  it('raises a button height under the touch target to 48, and can draw labels in capitals', () => {
    const base = themeById('park');
    const odd = { ...base, style: { ...base.style, buttonHeight: 40, buttonRadius: 8, buttonCase: 'upper' as const, fabShadow: false } };
    const c = buildControls(odd);
    expect(c.button).toEqual({ borderRadius: 8, minHeight: 48 });
    expect(c.iconMark.borderRadius).toBe(8);
    expect(c.buttonLabel).toEqual({ textTransform: 'uppercase' });
    expect(c.fab).toMatchObject({ elevation: 0, shadowOpacity: 0 });
  });
});

describe('Clean+ equals the spec', () => {
  const t = themeById('clean');
  const scheme = t.colors.light;

  it('uses the spec colours for the roles they name', () => {
    const k = CLEAN_SPEC.colors;
    expect(scheme.primary).toBe(k.accent);
    expect(scheme.steps).toBe(k.accent);
    expect(scheme.water).toBe(k.accent);
    expect(scheme.food).toBe(k.warm);
    expect(scheme.foodContainer).toBe(k.warmTint);
    expect(scheme.sleep).toBe(k.indigo);
    expect(scheme.sleepContainer).toBe(k.indigoTint);
    expect(scheme.over).toBe(k.warn);
    expect(scheme.onSurface).toBe(k.ink);
    expect(scheme.onSurfaceVariant).toBe(k.muted);
    expect(scheme.surface).toBe(k.white);
    expect(scheme.outlineVariant).toBe(k.hair);
  });

  it('is light and the same with the phone in dark mode', () => {
    expect(t.mode).toBe('light');
    expect(t.colors.dark).toEqual(t.colors.light);
    expect(groundOf(t)).toBe(CLEAN_SPEC.colors.white);
  });

  it('sets the spec type: Poppins 300/400/500, sizes and lines', () => {
    const fonts = buildFonts(t, 'android');
    const type = buildType(t, fonts);
    const sp = CLEAN_SPEC.type;
    expect(type.bodyLarge).toMatchObject({ fontFamily: 'Poppins_400Regular', fontSize: sp.body.size, lineHeight: sp.body.lineHeight });
    expect(type.bodySmall).toMatchObject({ fontFamily: 'Poppins_400Regular', fontSize: sp.caption.size, lineHeight: sp.caption.lineHeight });
    expect(type.titleMedium).toMatchObject({ fontFamily: 'Poppins_500Medium', fontSize: sp.value.size, lineHeight: sp.value.lineHeight });
    expect(type.titleLarge).toMatchObject({ fontFamily: 'Poppins_500Medium', fontSize: sp.title.size, lineHeight: sp.title.lineHeight });
    expect(type.numeralHero).toMatchObject({
      fontFamily: 'Poppins_300Light',
      fontSize: sp.display.size,
      lineHeight: sp.display.lineHeight,
      letterSpacing: sp.display.letterSpacing,
    });
    for (const face of Object.values(t.fonts)) expect(face.family).toMatch(/^Poppins_(300Light|400Regular|500Medium)$/);
  });

  it('takes its radii, map and buttons from the spec', () => {
    const r = CLEAN_SPEC.radius;
    // Roles as tokens.ts defines them: md cards and tiles, lg the FAB.
    expect(t.radius.md).toBe(r.card);
    expect(t.radius.lg).toBe(r.fab);
    expect(t.radius.sm).toBe(r.pill);
    expect(t.style.buttonRadius).toBe(r.button);
    expect(t.style.buttonHeight).toBe(CLEAN_SPEC.sizes.button.height);
    expect(t.map).toMatchObject({
      land: CLEAN_SPEC.colors.mapLand,
      water: CLEAN_SPEC.colors.mapWater,
      route: CLEAN_SPEC.colors.accent,
      radius: r.map,
      height: CLEAN_SPEC.sizes.map.height,
    });
  });

  it('every colour is a spec colour or one of the approved exceptions', () => {
    const allowed = new Set<string>([...Object.values(CLEAN_SPEC.colors), ...CLEAN_OFF_SPEC]);
    for (const [role, hex] of Object.entries(scheme)) expect({ role, ok: allowed.has(hex) }).toEqual({ role, ok: true });
    expect(scheme.lane).toBe(CLEAN_SPEC.colors.hair);
  });

  it('every type role is one of the spec steps, in its face', () => {
    const fonts = buildFonts(t, 'android');
    const built = buildType(t, fonts);
    const sp = CLEAN_SPEC.type;
    const steps = [sp.caption, sp.body, sp.value, sp.title, sp.display];
    const face = { 300: 'Poppins_300Light', 400: 'Poppins_400Regular', 500: 'Poppins_500Medium' } as const;
    for (const role of TYPE_ROLES) {
      const b = built[role];
      const step = steps.find((s) => s.size === b.fontSize && s.lineHeight === b.lineHeight);
      expect({ role, step: Boolean(step) }).toEqual({ role, step: true });
      // Size and line fix the step; the face is the step's weight, except body-size labels and titles at 500.
      if (step === sp.display || step === sp.caption || step === sp.title || step === sp.value)
        expect({ role, face: b.fontFamily }).toEqual({ role, face: face[step.weight] });
      else expect({ role, ok: [face[400], face[500]].includes(b.fontFamily as never) }).toEqual({ role, ok: true });
    }
    expect(built.headlineMedium).toMatchObject({ fontSize: 22, lineHeight: 30 });
  });

  it('loads only the weights the spec uses', () => {
    expect(Object.keys(fontMap(t)).sort()).toEqual(['Poppins_300Light', 'Poppins_400Regular', 'Poppins_500Medium']);
  });
});
