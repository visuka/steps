/**
 * The colours drawn on a blue hero block (spec 2): text on it, the "78%" pill,
 * quiet bars, the dashed goal line, the selected day's track. The scheme has no
 * roles for them, so Clean+ takes the spec's own values and every other look
 * mixes them from its primary and onPrimary (the same relationships: the
 * mockup's are onPrimary laid over primary at about 82, 15, 34 and 64 %).
 */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import type { BlockColors } from '@/constants/themes/types';
import type { ColorScheme, ThemeColor } from '@/constants/tokens';

export interface HeroColors {
  /** Text and bars that count: white in Clean+. */
  strong: string;
  /** Labels and "of 8,000" (onBlue). */
  label: string;
  /** The "78%" pill fill (heroPill). */
  pill: string;
  /** Bars for hours with no steps (heroBarQuiet). */
  quietBar: string;
  /** The dashed goal-pace line (heroGoalLine). */
  goalLine: string;
}

/**
 * A look whose steps block is not primary (ThemeStyle.heroFill): C draws it on
 * paper with saffron marks, D as the leaf block. Roles of the scheme.
 */
export interface HeroFill {
  fill: ThemeColor;
  ink: ThemeColor;
  /** The counted bars (and the number when markNumber), e.g. C's saffron. */
  mark?: ThemeColor;
  markNumber?: boolean;
}

export interface HeroPalette extends HeroColors {
  /** The block's own colour. */
  fill: string;
  /** Counted bars. */
  mark: string;
  /** The big number. */
  number: string;
}

/** Every colour of the steps block for a look: primary unless the look names its own. */
export function heroPalette(theme: ColorScheme, spec?: HeroFill, block?: BlockColors): HeroPalette {
  // A look's dark block (F, Sport data): its own plate, lane and signal mark, as drawn.
  if (!spec && block) {
    const h = heroColors({ primary: block.plate, onPrimary: block.text });
    return { ...h, label: block.quiet, quietBar: block.lane, fill: block.plate, mark: block.mark, number: block.text };
  }
  if (!spec) {
    const h = heroColors(theme);
    return { ...h, fill: theme.primary, mark: h.strong, number: h.strong };
  }
  const base = { primary: String(theme[spec.fill]), onPrimary: String(theme[spec.ink]) };
  const h = heroColors(base);
  const mark = spec.mark ? String(theme[spec.mark]) : h.strong;
  return { ...h, fill: base.primary, mark, number: spec.markNumber ? mark : h.strong };
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** `top` laid over `base` at `share` (0-1), as #RRGGBB. */
export function mixHex(base: string, top: string, share: number): string {
  const a = parse(base);
  const b = parse(top);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * share));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * The mid tone: the track behind a fill drawn in primary (water pips, the empty
 * week track). Clean+ takes its secondaryContainer (accentMid); every other look
 * mixes it from surface and primary, because there secondaryContainer can equal
 * primary (look F) or the tint under a selected box.
 */
export function midTone(theme: Pick<ColorScheme, 'primary' | 'surface' | 'secondaryContainer'>): string {
  const k = CLEAN_SPEC.colors;
  if (theme.primary.toUpperCase() === k.accent && theme.secondaryContainer.toUpperCase() === k.accentMid) {
    return theme.secondaryContainer;
  }
  return mixHex(theme.surface, theme.primary, 0.18);
}

export function heroColors(theme: Pick<ColorScheme, 'primary' | 'onPrimary'>): HeroColors {
  const k = CLEAN_SPEC.colors;
  if (theme.primary.toUpperCase() === k.accent && theme.onPrimary.toUpperCase() === k.white) {
    return { strong: k.white, label: k.onBlue, pill: k.heroPill, quietBar: k.heroBarQuiet, goalLine: k.heroGoalLine };
  }
  return {
    strong: theme.onPrimary,
    label: mixHex(theme.primary, theme.onPrimary, 0.82),
    pill: mixHex(theme.primary, theme.onPrimary, 0.15),
    quietBar: mixHex(theme.primary, theme.onPrimary, 0.34),
    goalLine: mixHex(theme.primary, theme.onPrimary, 0.64),
  };
}
