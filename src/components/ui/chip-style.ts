/** The Clean+ chip (spec 5.9 and the filter chips), as plain numbers. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

const MIN_TOUCH = CLEAN_SPEC.sizes.nav.minTouch;

export const CHIP_STYLE = {
  radius: CLEAN_SPEC.radius.chip,
  /** A minimum: grows with large text. */
  minHeight: CLEAN_SPEC.sizes.chip.height,
  /** Padding 0 12 0 16 when a trailing chevron is drawn, 16 both sides otherwise. */
  paddingLeft: CLEAN_SPEC.space.s16,
  paddingRight: CLEAN_SPEC.space.s12,
  paddingRightPlain: CLEAN_SPEC.space.s16,
  /** Between the label and the trailing chevron. */
  gapTrailing: CLEAN_SPEC.space.s4,
  /** Between a leading mark (tick, icon, dot) and the label (unchanged from before the spec). */
  gap: CLEAN_SPEC.space.s8,
  iconSize: CLEAN_SPEC.icon.size,
  /** The legend dot before a label (spec 5.10): 8 x 8, fully round. */
  dotSize: 8,
  dotRadius: CLEAN_SPEC.radius.dot,
  minTouch: MIN_TOUCH,
} as const;

/** Vertical hit slop that lifts the 40 dp chip to the 48 dp touch target. */
export function chipHitSlopVertical(): number {
  return Math.max(0, Math.ceil((MIN_TOUCH - CHIP_STYLE.minHeight) / 2));
}
