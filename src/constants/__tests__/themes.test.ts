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
import { buildControls, buildFonts, buildType, faceForWeight, fontMap, numeralFontOf, uiFontOf } from '../themes/build';
import { TouchTarget, TYPE_ROLES } from '../tokens';

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
  it('lists park, a, b, c, d, e, f in that order, each once', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['park', 'a', 'b', 'c', 'd', 'e', 'f']);
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
  });

  it('defaults to Colour blocks', () => {
    expect(DEFAULT_THEME_ID).toBe('d');
    expect(themeById('d').name).toBe('Colour blocks');
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s is complete', (_id, t) => {
    expect(t.name.length).toBeGreaterThan(0);
    expect(t.description.length).toBeGreaterThan(0);
    expect(['system', 'light', 'dark']).toContain(t.mode);
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

  it('the window behind a restart takes the new theme’s ground for the phone’s scheme', () => {
    expect(groundOf(themeById('d'), 'light')).toBe('#FFFFFF');
    expect(groundOf(themeById('d'), 'dark')).toBe(themeById('d').colors.dark.surface);
    expect(groundOf(themeById('d'), null)).toBe('#FFFFFF');
    // Night is dark only: dark ground on a light phone too.
    expect(groundOf(themeById('b'), 'light')).toBe(themeById('b').colors.dark.surface);
  });

  it('a one-scheme theme gives that scheme as both light and dark', () => {
    for (const t of THEMES) {
      if (t.mode === 'dark') expect(t.colors.light).toEqual(t.colors.dark);
      if (t.mode === 'light') expect(t.colors.dark).toEqual(t.colors.light);
    }
  });

  // The font stub gives each export its own name, so this checks the file, not just the label.
  it.each(THEMES.map((t) => [t.id, t] as const))('%s: every face is loaded under its own file’s name', (_id, t) => {
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

describe('saved choice', () => {
  it('reads the default when nothing is saved, the store is missing, or it fails', () => {
    expect(readThemeId(memoryStore())).toBe('d');
    expect(readThemeId(null)).toBe('d');
    expect(readThemeId(broken)).toBe('d');
  });

  it('ignores an unknown saved value', () => {
    expect(readThemeId(memoryStore({ [THEME_KEY]: 'neon' }))).toBe('d');
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
  it('uses the saved themeâ€™s faces and sizes', () => {
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

  it('F sets chips in small capitals; buttons keep sentence case everywhere, as drawn', () => {
    expect(controls('f').chipLabel).toEqual({ textTransform: 'uppercase' });
    expect(controls('f').chipType).toBe('labelMedium');
    for (const t of THEMES) expect(buildControls(t).buttonLabel).toEqual({});
    for (const id of ['park', 'a', 'b', 'c', 'd', 'e'] as const) expect(controls(id).chipLabel).toEqual({});
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
