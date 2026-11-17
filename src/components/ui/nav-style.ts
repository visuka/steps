import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

/**
 * The bottom bar (docs/design.md "Bottom bar", owner 17 Nov 2026): a row of
 * round buttons on the screen's own ground, no hairline and no labels drawn
 * (TalkBack still says each name). The selected one is a near-white circle
 * with a black icon; the others grey circles. Pure numbers; colours come
 * from the day palette on Today and from theme roles elsewhere.
 */
export const NAV = {
  /** Bar height without the system inset. */
  height: 60,
  /** No hairline on top. */
  hairline: 0,
  sidePadding: 8,
  /** Each round button. */
  slotWidth: 48,
  /** Space between the buttons. */
  slotGap: 16,
  iconSize: 22,
  minTouch: CLEAN_SPEC.sizes.nav.minTouch,
} as const;

/** The drawn slot: a 48 dp circle. */
export const SLOT_VISUAL_HEIGHT = NAV.slotWidth;

/** The touch area of a slot: at least 48 x 48, centred on the drawn slot. */
export function slotTouch(): { width: number; height: number } {
  return { width: Math.max(NAV.slotWidth, NAV.minTouch), height: Math.max(SLOT_VISUAL_HEIGHT, NAV.minTouch) };
}

/** Total bar height including the gesture or 3-button bar below. */
export function barHeight(bottomInset: number): number {
  return NAV.height + bottomInset;
}
