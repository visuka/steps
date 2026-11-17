import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

/**
 * The bottom bar (docs/design.md "Bottom bar", 17 Nov 2026): three buttons,
 * each an icon over a label, no lifted round button. Pure numbers; colours
 * come from the day palette on Today and from theme roles elsewhere.
 */
export const NAV = {
  /** Bar height without the system inset. */
  height: 60,
  /** The hairline on top, 1 dp. */
  hairline: 1,
  sidePadding: 8,
  slotWidth: 80,
  iconSize: 22,
  /** Gap between the icon and the label. */
  iconLabelGap: 3,
  labelSize: 11,
  labelLine: 14,
  minTouch: CLEAN_SPEC.sizes.nav.minTouch,
} as const;

/** The drawn slot: 22 icon + 3 gap + 14 label line = 39 high, 80 wide. */
export const SLOT_VISUAL_HEIGHT = NAV.iconSize + NAV.iconLabelGap + NAV.labelLine;

/** The touch area of a slot: at least 48 x 48, centred on the drawn slot. */
export function slotTouch(): { width: number; height: number } {
  return { width: Math.max(NAV.slotWidth, NAV.minTouch), height: Math.max(SLOT_VISUAL_HEIGHT, NAV.minTouch) };
}

/** Total bar height including the gesture or 3-button bar below. */
export function barHeight(bottomInset: number): number {
  return NAV.height + bottomInset;
}
