/** The tinted icon circle (spec 4, 5.5), as plain numbers and a colour picker. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import type { ColorScheme } from '@/constants/tokens';

import { pressedColor, pressedColorOnAccent } from './surface-style';

export type IconCircleTone = 'accent' | 'warm' | 'indigo' | 'grey' | 'accentSolid';

export const ICON_CIRCLE_STYLE = {
  size: CLEAN_SPEC.icon.circle,
  radius: CLEAN_SPEC.radius.circle,
  iconSize: CLEAN_SPEC.icon.size,
  minTouch: CLEAN_SPEC.sizes.nav.minTouch,
} as const;

type CircleTheme = Pick<
  ColorScheme,
  | 'primary'
  | 'onPrimary'
  | 'primaryContainer'
  | 'food'
  | 'foodContainer'
  | 'sleep'
  | 'sleepContainer'
  | 'surfaceContainer'
  | 'onSurfaceVariant'
>;

export function iconCircleColors(theme: CircleTheme, tone: IconCircleTone): { fill: string; icon: string } {
  switch (tone) {
    case 'warm':
      return { fill: theme.foodContainer, icon: theme.food };
    case 'indigo':
      return { fill: theme.sleepContainer, icon: theme.sleep };
    case 'grey':
      return { fill: theme.surfaceContainer, icon: theme.onSurfaceVariant };
    case 'accentSolid':
      return { fill: theme.primary, icon: theme.onPrimary };
    default:
      return { fill: theme.primaryContainer, icon: theme.primary };
  }
}

/** Pressed ripple: ink at 8 % on the tinted circles, onPrimary at 24 % on the solid accent one. */
export function iconCircleRipple(theme: Pick<ColorScheme, 'onSurface' | 'onPrimary'>, tone: IconCircleTone): string {
  return tone === 'accentSolid' ? pressedColorOnAccent(theme.onPrimary) : pressedColor(theme.onSurface);
}

/** Hit slop per side that lifts a circle of `size` to the 48 dp touch target. */
export function iconCircleHitSlop(size: number = ICON_CIRCLE_STYLE.size): number {
  return Math.max(0, Math.ceil((ICON_CIRCLE_STYLE.minTouch - size) / 2));
}
