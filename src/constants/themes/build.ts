/**
 * Turns a ThemeDef into what screens use: font family names (with the web
 * preview's fallback chain) and ready-made text styles. Plain functions, so
 * jest can check the type built for any theme; theme.ts calls them once for
 * the active theme.
 */

import type { TextStyle, ViewStyle } from 'react-native';

import type { ColorScheme, FontWeightName, ThemeColor, TypeRole, TypeSpec } from '../tokens';
import { TouchTarget, TYPE_ROLES } from '../tokens';
import type { ColorRef, LabelCase, MapColors, ThemeDef } from './types';

/**
 * None of the theme faces has Indian scripts: Android draws those with the
 * system's Noto fonts, glyph by glyph. The web preview names the same fallback.
 */
const WEB_FALLBACK = ", 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Telugu', system-ui, sans-serif";

export interface FontSet {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  numeralMedium: string;
  numeral: string;
  /** Kept for old code that asked for these. */
  sans: string;
  rounded: string;
  serif: string;
  mono: string;
}

export function buildFonts(theme: ThemeDef, os: string): FontSet {
  const web = os === 'web';
  const family = (name: string) => (web ? `${name}${WEB_FALLBACK}` : name);
  const f = theme.fonts;
  return {
    regular: family(f.regular.family),
    medium: family(f.medium.family),
    semibold: family(f.semibold.family),
    bold: family(f.bold.family),
    numeralMedium: family(f.numeralMedium.family),
    numeral: family(f.numeral.family),
    sans: family(f.regular.family),
    rounded: family(f.medium.family),
    serif: web ? 'Georgia, serif' : 'serif',
    mono: web ? 'ui-monospace, monospace' : 'monospace',
  };
}

/** The UI face for a weight name or a CSS-style weight (400, '600', 'bold'). */
export function uiFontOf(fonts: FontSet, weight: FontWeightName | TextStyle['fontWeight'] | undefined): string {
  switch (weight) {
    case 'medium':
    case '500':
    case 500:
      return fonts.medium;
    case 'semibold':
    case '600':
    case 600:
      return fonts.semibold;
    case 'bold':
    case '700':
    case 700:
    case '800':
    case 800:
    case '900':
    case 900:
    case 'heavy':
    case 'black':
      return fonts.bold;
    default:
      return fonts.regular;
  }
}

/** The numeral face for a weight: 500 and below are the medium file, the rest the numeral file. */
export function numeralFontOf(fonts: FontSet, weight: FontWeightName | TextStyle['fontWeight'] | undefined): string {
  switch (weight) {
    case 'regular':
    case 'medium':
    case 'normal':
    case '400':
    case 400:
    case '500':
    case 500:
      return fonts.numeralMedium;
    default:
      return fonts.numeral;
  }
}

/**
 * The file for text drawn in `family` with a fontWeight override, or null for
 * a face the theme doesn't own (monospace). A file can be both a UI weight and
 * a numeral weight (A's Inter 600), so the family alone can't say which scale
 * to use: UI text takes the UI weights unless the text is a numeral role
 * (`numeral`), or the family is only a numeral face (park's condensed, C's
 * Fraunces titles).
 */
export function faceForWeight(
  fonts: FontSet,
  family: string | undefined,
  weight: FontWeightName | TextStyle['fontWeight'] | undefined,
  numeral = false,
): string | null {
  const ui = [fonts.regular, fonts.medium, fonts.semibold, fonts.bold];
  const nums = [fonts.numeralMedium, fonts.numeral];
  if (numeral && (!family || nums.includes(family))) return numeralFontOf(fonts, weight);
  if (!family || ui.includes(family)) return uiFontOf(fonts, weight);
  if (nums.includes(family)) return numeralFontOf(fonts, weight);
  return null;
}

function toStyle(spec: TypeSpec, fonts: FontSet, tabular: boolean): TextStyle {
  return {
    fontFamily: spec.numeral || spec.display ? numeralFontOf(fonts, spec.weight) : uiFontOf(fonts, spec.weight),
    fontSize: spec.size,
    lineHeight: spec.line,
    letterSpacing: spec.tracking,
    ...(spec.numeral && tabular ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null),
  };
}

/** Ready-made text styles for every role of the theme's type scale. */
export function buildType(theme: ThemeDef, fonts: FontSet): Record<TypeRole, TextStyle> {
  return Object.fromEntries(
    TYPE_ROLES.map((role) => [role, toStyle(theme.type[role], fonts, theme.style.numeralTabular)]),
  ) as Record<TypeRole, TextStyle>;
}

/** The shapes of buttons, chips and the FAB for a theme (components/ui reads these). */
export interface ControlStyles {
  /** Common buttons: corner radius and minimum height (at least the 48 dp target). */
  button: { borderRadius: number; minHeight: number };
  /** Full-width main action buttons ("Log food", "Save to lunch"): taller where the mockup draws them so. */
  action: { borderRadius: number; minHeight: number };
  /** Common and segmented button labels: capitals or as written. */
  buttonLabel: TextStyle;
  /** The 40 dp mark of a tonal or filled icon button. */
  iconMark: { borderRadius: number };
  /** The chip label's type role and case. */
  chipType: 'labelLarge' | 'labelMedium';
  chipLabel: TextStyle;
  /** The extended FAB: corner radius and shadow (none when the theme is flat). */
  fab: ViewStyle;
}

const ICON_MARK = 40;

function caseStyle(c: LabelCase | undefined): TextStyle {
  return c === 'upper' ? { textTransform: 'uppercase' } : {};
}

/**
 * The control shapes of a theme. Left-out options keep park's look (see
 * ThemeStyle); a height under the touch target is raised to it.
 */
export function buildControls(theme: ThemeDef): ControlStyles {
  const s = theme.style;
  const buttonRadius = s.buttonRadius ?? theme.radius.full;
  const shadow = s.fabShadow ?? true;
  return {
    button: { borderRadius: buttonRadius, minHeight: Math.max(TouchTarget, s.buttonHeight ?? TouchTarget) },
    action: {
      borderRadius: buttonRadius,
      minHeight: Math.max(TouchTarget, s.actionHeight ?? s.buttonHeight ?? TouchTarget),
    },
    buttonLabel: caseStyle(s.buttonCase),
    iconMark: { borderRadius: Math.min(buttonRadius, ICON_MARK / 2) },
    chipType: s.chipCase === 'upper' ? 'labelMedium' : 'labelLarge',
    chipLabel: caseStyle(s.chipCase),
    fab: {
      borderRadius: s.fabRadius ?? theme.radius.lg,
      // Material level 3: a soft, offset shadow.
      ...(shadow
        ? { elevation: 3, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }
        : { elevation: 0, shadowOpacity: 0 }),
    },
  };
}

/** The theme's font files by family name, for expo-font. */
export function fontMap(theme: ThemeDef): Record<string, number | string> {
  return Object.fromEntries(Object.values(theme.fonts).map((f) => [f.family, f.source]));
}

/** A colour reference (a role name or a hex) as a colour in the scheme. */
export function resolveColor(c: ColorScheme, ref: ColorRef): string {
  return ref.startsWith('#') ? ref : c[ref as ThemeColor];
}

/**
 * The walk map's colours: the theme's own (the mockup's map), or, for a theme
 * without them (park), the OpenFreeMap style for the scheme with the route in
 * steps colour.
 */
export function mapColorsOf(theme: ThemeDef, scheme: 'light' | 'dark', radius = theme.radius.md): MapColors {
  if (theme.map) return theme.map;
  const c = theme.colors[scheme];
  return {
    base: scheme,
    land: c.surfaceContainerHigh,
    road: c.surfaceContainerLowest,
    minorRoad: c.surfaceContainerLow,
    park: c.stepsContainer,
    water: c.waterContainer,
    building: c.surfaceContainerHighest,
    label: c.onSurfaceVariant,
    border: null,
    radius,
    height: 176,
    route: c.steps,
    routeWidth: 5,
    casing: c.surface,
    start: c.tick,
    startRing: c.steps,
    end: c.steps,
    endRing: c.steps,
  };
}
