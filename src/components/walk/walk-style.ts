/**
 * The walk screen's numbers (docs/design/spec.md 5.9, 5.11, 6): one layout for
 * every look, from CLEAN_SPEC. Pure, so the tests can check them.
 */

import type { SpecIconName } from '@/components/ui/icon-paths';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import type { StatId } from './walk-model';

const { space, sizes, radius, shadow, icon } = CLEAN_SPEC;

export const WALK_STYLE = {
  sideMargin: space.sideMargin,
  /** Under the status bar (spec 7: top padding 16). */
  topGap: space.s16,
  topBarHeight: sizes.topBar.height,
  /** The chevron's left edge sits at x = 20. */
  backMarginLeft: -4,
  backIconSize: icon.size,
  /** Title under the top bar, and the info row under the title. */
  titleGap: space.s8,
  infoGap: space.s4,
  infoHeight: 24,
  infoItemGap: space.s8,
  /** Map, distance row and stat cards each 16 apart. */
  blockGap: space.s16,
  map: { height: sizes.map.height, radius: radius.map, boxShadow: shadow.card },
  /** Start and end dots: radius to the middle of the ring, and the ring's width. */
  dots: { start: { r: 6, ring: 2.5 }, end: { r: 6.5, ring: 2.5 } },
  distanceGap: space.s8,
  sparkline: { width: sizes.sparkline.width, height: sizes.sparkline.height, labelGap: space.s4, lineWidth: 2 },
  stat: {
    height: sizes.statCard.height,
    paddingX: space.s16,
    gap: space.s12,
    radius: radius.card,
    boxShadow: shadow.card,
    columns: 2,
  },
  partsGap: space.s24,
  partsGroupGap: space.s4,
  part: { height: sizes.ingredientRow.partsHeight, gap: sizes.ingredientRow.gap, hairline: 1 },
  /** "Keep" / "Remove" at the right of a part row: a 48 dp touch target. */
  keepMinHeight: sizes.nav.minTouch,
  segmented: {
    width: sizes.segmented.width,
    height: sizes.segmented.height,
    padding: sizes.segmented.padding,
    radius: radius.well,
    selectedRadius: radius.segment,
    boxShadow: shadow.segment,
  },
} as const;

/** The icon in a stat card's circle. The mockup draws the first four; the rest reuse the nearest icon. */
export const STAT_ICON: Record<StatId, SpecIconName> = {
  time: 'clock',
  steps: 'feet',
  pace: 'gauge',
  floors: 'stairs',
  avgSpeed: 'gauge',
  topSpeed: 'gauge',
  climb: 'stairs',
  kcal: 'pulse',
  effort: 'pulse',
};

/** The width of one of the three segments, dp: (216 - 8) / 3 = 69.33. */
export function segmentWidth(): number {
  return (WALK_STYLE.segmented.width - 2 * WALK_STYLE.segmented.padding) / 3;
}

/** Items in rows of `n` (the stat cards, two to a row). */
export function chunk<T>(items: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
