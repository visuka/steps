import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { SCREEN } from './screen-style';

const { space, type, sizes } = CLEAN_SPEC;

/** Spec 5.10: the heading row ("Ingredients"). */
export const SECTION = {
  /** Margin above the first heading of a screen and between big groups. */
  gapSection: space.s24,
  /** Margin above a sub-heading ("Nutrients"). */
  gapSub: space.s16,
  /** Gap between the left text and the caption or action. */
  gap: space.s8,
  /** Heading text line height (15/22). */
  lineHeight: type.body.lineHeight,
  minTouch: sizes.nav.minTouch,
} as const;

export type SectionGap = 'section' | 'sub';

/** True when the row holds a button or a "Why?": it then needs a 48 dp touch height. */
export function rowTouchHeight(interactive: boolean): number {
  return interactive ? SECTION.minTouch : 0;
}

/**
 * Margin above the row. Assumes the heading sits directly inside Screen's
 * block column, which already adds SCREEN.blockGap (16) above it, so the
 * header's own margin is the spec distance (24 / 16) minus that gap. A row
 * with a button is 48 high so the tap target is large enough; the text stays
 * centred, so the margin is reduced further by the extra above the line (13).
 * Gap + margin + extra = the spec 24 / 16 above the heading text, in both
 * cases. The margin can be negative: the 48 dp row then overlaps the empty
 * space above the previous block's gap, which is only padding.
 */
export function headerMarginTop(gap: SectionGap, interactive: boolean): number {
  const base = gap === 'sub' ? SECTION.gapSub : SECTION.gapSection;
  const extra = interactive ? (SECTION.minTouch - SECTION.lineHeight) / 2 : 0;
  return base - SCREEN.blockGap - extra;
}

/** Visual distance from the previous block to the heading text inside Screen's gap column. */
export function headingTextDistance(gap: SectionGap, interactive: boolean): number {
  const extra = interactive ? (SECTION.minTouch - SECTION.lineHeight) / 2 : 0;
  return SCREEN.blockGap + headerMarginTop(gap, interactive) + extra;
}
