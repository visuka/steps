import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { pressedColor } from './surface-style';

const { ingredientRow, nav } = CLEAN_SPEC.sizes;

/** Spec 5.10 and 5.11: ingredient and part rows. */
export const ROW = {
  height: ingredientRow.height,
  tallHeight: ingredientRow.partsHeight,
  gap: ingredientRow.gap,
  /** The hairline under the text part, 1 dp (`hair`, outlineVariant role). */
  hairline: 1,
  minTouch: nav.minTouch,
  /** Rows that do not pass the new props keep Material's 56 / 72. */
  legacyHeight: 56,
  legacyHeightSupporting: 72,
  disabledOpacity: 0.38,
} as const;

export interface RowLook {
  /** The spec layout (24 screen margin applies, hairline under the text part). */
  spec: boolean;
  minHeight: number;
  /** Draw the hairline under the text part. */
  hairline: boolean;
}

/**
 * Decides the row's look. Passing any of tall / last / hairline selects the
 * spec layout; otherwise the row is the old Material one.
 */
export function rowLook(opts: { supporting?: boolean; tall?: boolean; last?: boolean; hairline?: boolean }): RowLook {
  const spec = opts.tall !== undefined || opts.last !== undefined || opts.hairline !== undefined;
  if (!spec) {
    return { spec: false, minHeight: opts.supporting ? ROW.legacyHeightSupporting : ROW.legacyHeight, hairline: false };
  }
  return {
    spec: true,
    minHeight: opts.tall ? ROW.tallHeight : ROW.height,
    hairline: opts.hairline ?? !opts.last,
  };
}

/** Spec 10.3: pressed = ripple only, ink at 8 %, bounded to the row (foreground so it draws over the content). */
export function rowRipple(ink: string): { color: string; foreground: true } {
  return { color: pressedColor(ink), foreground: true };
}
