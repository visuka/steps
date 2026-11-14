import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

const { space, sizes, icon } = CLEAN_SPEC;

/**
 * The page frame's numbers (spec 5.9 and 7). Pure so a test can pin them.
 * Content starts below the status bar: top padding = the inset plus the spec
 * gap (24 on a tab screen, 16 on a screen pushed over the tabs).
 */
export const SCREEN = {
  sideMargin: space.sideMargin,
  /** Gap under the status bar on a tab screen with a large title. */
  topGapTab: space.s24,
  /** Gap under the status bar on a screen with a back control. */
  topGapPushed: space.s16,
  /** Gap between the blocks of a screen (the spec's usual 16). */
  blockGap: space.s16,
  /** Room kept under the last block. */
  bottomGap: space.s24,
  /** Spec 10.3: a snackbar or FAB sits 16 above the bottom bar inside the tabs. */
  overlayGapTabs: space.s16,
  /** Spec 10.3: and 24 above the screen bottom where there is no bar. */
  overlayGapPushed: space.s24,
  /** Height of the title row of a sub-screen (the top bar). */
  topBarHeight: sizes.topBar.height,
  back: {
    iconSize: icon.size,
    /** The chevron's left edge sits at x = 20: margin-left -4 on a 24 margin. */
    marginLeft: -4,
    /** Gap from the chevron to the title. */
    titleGap: space.s8,
  },
  fabSize: sizes.nav.fab,
  fabGap: space.s16,
  minTouch: sizes.nav.minTouch,
} as const;

/** The status-bar inset plus the spec gap: fixes "header under the status bar". */
export function topPadding(insetTop: number, hasBack: boolean): number {
  return insetTop + (hasBack ? SCREEN.topGapPushed : SCREEN.topGapTab);
}

/**
 * Extra touch area around the back chevron so the target is at least 48 x 48
 * while the drawn control stays 20 wide and as high as the top bar.
 */
export function backHitSlop(): { top: number; bottom: number; left: number; right: number } {
  const horizontal = Math.max(0, (SCREEN.minTouch - SCREEN.back.iconSize) / 2);
  const vertical = Math.max(0, (SCREEN.minTouch - SCREEN.topBarHeight) / 2);
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

/** Left offset of a subtitle so it lines up with the title beside the back chevron. */
export function subtitleIndent(): number {
  return SCREEN.back.iconSize + SCREEN.back.marginLeft + SCREEN.back.titleGap;
}

/**
 * Bottom padding of the scroll content. Inside the tabs the bar takes its own
 * room; a pushed screen keeps clear of the gesture bar. A FAB adds its height.
 */
export function bottomPadding(inTabs: boolean, insetBottom: number, hasFab: boolean): number {
  return (inTabs ? 0 : insetBottom) + SCREEN.bottomGap + (hasFab ? SCREEN.fabSize + SCREEN.fabGap : 0);
}

/**
 * Bottom offset of the overlay / FAB layer (spec 10.3). Inside the tabs the
 * bar already clears the gesture inset, so the layer sits 16 above the bar;
 * on a pushed screen it sits 24 above the screen bottom plus the inset.
 */
export function bottomOffset(inTabs: boolean, insetBottom: number): number {
  return inTabs ? SCREEN.overlayGapTabs : insetBottom + SCREEN.overlayGapPushed;
}
