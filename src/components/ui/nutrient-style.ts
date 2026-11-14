/** The nutrient row (spec 5.10 .nut) as plain numbers and label builders. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

const N = CLEAN_SPEC.sizes.nutrientRow;

export const NUTRIENT_STYLE = {
  /** A minimum: at 1.3x text the row grows, never clips. */
  minHeight: N.height,
  gap: N.gap,
  nameWidth: N.nameWidth,
  valueWidth: N.valueWidth,
  /** Between the name and the "High" pill, inside the name column. */
  pillGap: CLEAN_SPEC.space.s8,
  barHeight: CLEAN_SPEC.sizes.bar.height,
  barRadius: CLEAN_SPEC.radius.bar,
} as const;

/** Fill share kept between 0 and 1 (over 100 % is a full bar). */
export function clampShare(share: number): number {
  return Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0;
}

export function nutrientLabel(name: string, value: string, share: number, warn?: boolean): string {
  const base = `${name}, ${value}, ${Math.round(clampShare(share) * 100)} percent of daily need`;
  return warn ? `${base}, high` : base;
}
