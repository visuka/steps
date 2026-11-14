/**
 * What a theme is. Each theme is one file in this folder (park.ts, a.ts … f.ts)
 * exporting a ThemeDef as its default; index.ts lists them in order.
 *
 * Plain data with no React Native, so jest can check every theme. Font
 * sources are the @expo-google-fonts files (numbers once bundled); jest
 * maps those packages to a stub.
 *
 * The rules every theme keeps (tokens.ts, tested in __tests__/tokens.test.ts):
 * flat colour only; body text 4.5:1 and large text and marks 3:1 in every
 * scheme; colour is never the only signal; touch targets 48 dp; Indian
 * scripts fall back to the phone's Noto fonts; sizes follow the phone's text size.
 */

import type { ColorScheme, FontWeightName, RadiusScale, ThemeColor, TypeScaleShape } from '../tokens';

/** In the order the Appearance picker shows them: Clean+ first. */
export const THEME_IDS = ['clean', 'park', 'a', 'b', 'c', 'd', 'e', 'f'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** Clean+ (blue). */
export const DEFAULT_THEME_ID: ThemeId = 'clean';

/** One loaded font file: the family name screens ask for, and the file. */
export interface ThemeFont {
  /** The name it is loaded under, e.g. 'PlusJakartaSans_700Bold' (the export's own name). */
  family: string;
  /** The @expo-google-fonts export, e.g. PlusJakartaSans_700Bold. */
  source: number | string;
}

/**
 * The faces a theme uses: four UI weights and two numeral weights. A theme
 * may point two weights at the same file (D's numerals are its UI face at 700
 * and 800). The type scale's weight names pick among these.
 */
export interface ThemeFonts {
  regular: ThemeFont;
  medium: ThemeFont;
  semibold: ThemeFont;
  bold: ThemeFont;
  /** Numerals at weight regular or medium. */
  numeralMedium: ThemeFont;
  /** Numerals at weight semibold or bold. */
  numeral: ThemeFont;
}

/**
 * The few switches the shared components in components/ui read, so a theme
 * looks like its mockup on Today, Food and Walk without screens knowing which
 * theme is on.
 */
export interface ThemeStyle {
  /**
   * Stat tiles and cards that carry a data tone (StatTile/Card `tone`):
   * - 'filled': the tone's container colour, text in its `on` colour (D).
   * - 'outlined': surfaceContainerLowest with a 1 dp outlineVariant border.
   * - 'plain': a tonal surfaceContainer plate (park).
   * Untoned cards: 'plain' keeps tonal plates; 'filled' and 'outlined' draw
   * level 0 to 2 cards outlined, level 3 and 4 stay tonal.
   */
  tile: 'filled' | 'outlined' | 'plain';
  /**
   * How a progress hero is drawn (TrackProgress: Today's steps, Food's day energy):
   * - 'track': the oval running track with the number in its infield (park).
   * - 'ring': a circular ring, the number inside (A, B).
   * - 'bar': the number left-aligned over a thick bar (C, E, F).
   * - 'block': like 'bar', on a block of the tone's container colour (D).
   */
  hero: 'track' | 'ring' | 'bar' | 'block';
  /**
   * Straight progress bars (TickBar):
   * - 'ticked': ticks every tenth (park).
   * - 'solid': one flat fill, round ends (D, E).
   * - 'segmented': ten separate segments (C, F).
   */
  bar: 'ticked' | 'solid' | 'segmented';
  /**
   * The navigation bar's selected pill:
   * - 'neutral': secondaryContainer for every tab (park).
   * - 'tone': each tab's data container (Today and Activity steps, Food food, Journal and You sleep) (D).
   */
  navIndicator: 'neutral' | 'tone';
  /** Tabular (fixed-width) figures in the numeral styles, so counts don't jiggle. */
  numeralTabular: boolean;
  /*
   * Buttons, chips and the FAB (build.ts buildControls turns these into styles).
   * Each is optional; left out, it is park's look: pill buttons 48 dp tall,
   * labels as written, the FAB at radius.lg with its level 3 shadow.
   */
  /**
   * Corner radius of common and segmented buttons, dp; radius.full (999) is a
   * pill. Icon button marks take the same, up to their 20 dp half-width.
   * A, B, D: pills; C, F: 12; E: 20.
   */
  buttonRadius?: number;
  /** Minimum height of common buttons, dp. Never under 48 (the touch target). E: 56. */
  buttonHeight?: number;
  /** Case of button and FAB labels. The screen reader always gets the label as written. */
  buttonCase?: LabelCase;
  /**
   * Case of chip labels. 'upper' also sets them in labelMedium (F's small,
   * tracked capitals, as its "HIGH" tag).
   */
  chipCase?: LabelCase;
  /** Corner radius of the extended FAB, dp. Default radius.lg. */
  fabRadius?: number;
  /** The FAB's level 3 shadow. The flat mockups (A to F) draw none. Default true. */
  fabShadow?: boolean;
  /*
   * The options below reproduce each mockup (app-look/project). All are
   * optional; left out, a component keeps park's look.
   */
  /** Height of the full-width main action buttons ("Log food", "Save to lunch", "Edit" beside it), dp. A to F: 56. */
  actionHeight?: number;
  /**
   * Label of the smaller in-row buttons ("+ 1 glass", "Keep"); the full-width
   * action buttons use labelLarge. Weight names as in the type scale.
   */
  compactLabel?: { size: number; line: number; weight: FontWeightName };
  /** The colour pair filled buttons and the FAB paint with. Default 'primary'. F: 'tertiary' (its orange, ink label). */
  filledRole?: 'primary' | 'tertiary';
  /** Outlined buttons ("Edit", "Keep", "+ 1 glass"): edge, fill (null: none) and label. Default: outline, none, primary. */
  outlined?: { border: ColorRef; fill: ColorRef | null; ink: ColorRef };
  /** Section labels: "Ingredients", "Parts", "Nutrients · at least" (B, C, F: small tracked capitals). */
  overline?: LabelSpec;
  /** The small line above Today's title: B and F "TODAY", C "FRI, 14 NOV", D "Fri, 14 Nov". */
  kicker?: LabelSpec;
  /** The Walk / Run / Cycle segmented control. */
  segment?: SegmentLook;
  /** The navigation bar. */
  nav?: NavLook;
}

/** 'none' keeps a label as written; 'upper' draws it in capitals. */
export type LabelCase = 'none' | 'upper';

export interface ThemeDef {
  id: ThemeId;
  /** Shown in the picker, e.g. "Colour blocks". */
  name: string;
  /** One short line under the name. */
  description: string;
  /**
   * The scheme the theme keeps always; no theme follows the phone's light or
   * dark setting. A dark-only theme sets 'dark' and gives its dark scheme as
   * both `colors.light` and `colors.dark` (and the reverse for light-only).
   */
  mode: 'light' | 'dark';
  colors: { light: ColorScheme; dark: ColorScheme };
  fonts: ThemeFonts;
  type: TypeScaleShape;
  radius: RadiusScale;
  style: ThemeStyle;
  /** F's dark block. */
  block?: BlockColors;
  /** Walk map colours (one-scheme themes; mapColorsOf in build.ts). */
  map?: MapColors;
}

/** A colour role, or a hex the mockup draws that no role holds. */
export type ColorRef = ThemeColor | `#${string}`;

/** A text style outside the type scale, with its case and colour. */
export interface LabelSpec {
  size: number;
  line: number;
  weight: FontWeightName;
  /** dp. */
  tracking: number;
  case: LabelCase;
  color: ColorRef;
}

/** The Walk / Run / Cycle segmented control, as drawn in each mockup. */
export interface SegmentLook {
  /** The control's height, dp (the well, including its padding). */
  height: number;
  /** The well behind the segments (null: none) and its edge (null: none). */
  well: ColorRef | null;
  wellBorder: ColorRef | null;
  radius: number;
  /** Inset between the well and the segments, and between segments, dp. 0 for F's divided box. */
  pad: number;
  selected: ColorRef;
  onSelected: ColorRef;
  selectedBorder: ColorRef | null;
  selectedRadius: number;
  /** Label colour of the segments not selected. */
  idle: ColorRef;
  /** A 1 dp line between segments (F), or null. */
  divider: ColorRef | null;
  /** A check mark before the selected label (D). */
  check: boolean;
  label: { size: number; weight: FontWeightName; selectedWeight: FontWeightName };
}

/** The navigation bar. */
export interface NavLook {
  height: number;
  background: ColorRef;
  /** The 1 dp line on top. */
  border: ColorRef;
  /** The selected pill: a colour, or 'tone' for each tab's data container (D). */
  pill: ColorRef | 'tone';
  /** The selected icon's colour on the pill ('tone': the tone's ink). */
  onPill: ColorRef | 'tone';
  pillWidth: number;
  /** Label colour of the selected and other tabs. */
  active: ColorRef;
  idle: ColorRef;
  label: { size: number; line: number; weight: FontWeightName; activeWeight: FontWeightName };
}

/**
 * A dark block on a light page (F's black hero, food and walk blocks). On
 * `plate`: `text` and `quiet` 4.5:1, marks 3:1 (__tests__/themes.test.ts).
 */
export interface BlockColors {
  plate: string;
  text: string;
  /** Labels and units on the block. */
  quiet: string;
  /** Hairlines between stats. */
  rule: string;
  /** The unfilled part of a bar. */
  lane: string;
  /** The progress mark (steps), and the second and third marks of a split bar. */
  mark: string;
  mark2: string;
  mark3: string;
  /** The percentage chip. */
  chip: string;
  onChip: string;
  /** The 7-day chart: days at or over the average, under it, and the dashed average line. */
  barHigh: string;
  barLow: string;
  average: string;
}

/**
 * Walk map colours for a theme that keeps one scheme (the mockup's map): the
 * tiles are restyled with these and the route drawn as shown. A theme
 * without `map` (park) uses the OpenFreeMap style for the scheme and its
 * steps colour (mapColorsOf in build.ts).
 */
export interface MapColors {
  /** The OpenFreeMap style the tiles start from. */
  base: 'light' | 'dark';
  land: string;
  /** Main and minor streets. */
  road: string;
  minorRoad: string;
  park: string;
  water: string;
  building: string;
  /** Place and street names. */
  label: string;
  /** The map frame's 1 dp edge, or null. */
  border: string | null;
  radius: number;
  /** The mockup's map height on the walk screen, dp. */
  height: number;
  route: string;
  routeWidth: number;
  /** A line under the route in this colour, 4 dp wider, or null (the mockups draw none). */
  casing: string | null;
  /** The start dot: fill and ring. */
  start: string;
  startRing: string;
  /** The end dot: fill and ring. */
  end: string;
  endRing: string;
}

