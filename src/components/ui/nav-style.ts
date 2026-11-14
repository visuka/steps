import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

const { nav } = CLEAN_SPEC.sizes;

/** Spec 5.7: the bottom bar. Pure numbers and strings; colours come from theme roles. */
export const NAV = {
  /** Bar height without the system inset. */
  height: nav.height,
  /** The hairline on top, 1 dp (`hair`, drawn with the outlineVariant role). */
  hairline: 1,
  sidePadding: nav.sidePadding,
  slotWidth: nav.slot,
  iconSize: CLEAN_SPEC.icon.size,
  /** Gap between the icon and the dot. */
  iconDotGap: CLEAN_SPEC.space.s4,
  dot: nav.dot,
  dotRadius: nav.dot / 2,
  minTouch: nav.minTouch,
  fab: nav.fab,
  fabRadius: CLEAN_SPEC.radius.fab,
  fabLift: nav.fabLift,
  fabIconSize: CLEAN_SPEC.icon.size,
  fabShadow: CLEAN_SPEC.shadow.fab,
} as const;

/** The drawn slot: 20 icon + 4 gap + 4 dot = 28 high, 48 wide. */
export const SLOT_VISUAL_HEIGHT = NAV.iconSize + NAV.iconDotGap + NAV.dot;

/** The touch area of a slot: at least 48 x 48, centred on the drawn slot. */
export function slotTouch(): { width: number; height: number } {
  return { width: Math.max(NAV.slotWidth, NAV.minTouch), height: Math.max(SLOT_VISUAL_HEIGHT, NAV.minTouch) };
}

/** Total bar height including the gesture or 3-button bar below. */
export function barHeight(bottomInset: number): number {
  return NAV.height + bottomInset;
}

/**
 * The outer wrapper that holds the bar and the lifted FAB. Android delivers no
 * touches to the part of a child outside its parent, so the wrapper is as tall
 * as the bar plus the FAB's overhang (spec 5.7: 7.5 above the bar's outer top
 * edge) and the whole FAB lies inside it.
 */
export function wrapperHeight(bottomInset: number): number {
  return NAV.fabLift + barHeight(bottomInset);
}

/** The bar's outer top edge (where its 1 dp border starts), measured from the wrapper's top. */
export function barTopInWrapper(bottomInset: number): number {
  return wrapperHeight(bottomInset) - barHeight(bottomInset);
}

/** The FAB's top edge measured from the wrapper's top: exactly `fabLift` above the bar's outer top edge. */
export function fabTopInWrapper(bottomInset: number): number {
  return barTopInWrapper(bottomInset) - NAV.fabLift;
}
