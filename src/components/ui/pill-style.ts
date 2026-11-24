/** The Clean+ pill (spec 5.6), as plain numbers and a colour picker. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import type { ColorScheme } from '@/constants/tokens';

import type { BlockColors } from '@/constants/themes/types';

import { type HeroFill, heroColors } from './hero-colors';

export type PillVariant = 'tint' | 'hero' | 'warning';

export const PILL_STYLE = {
  /** A minimum: grows with large text, never clips. */
  minHeight: CLEAN_SPEC.sizes.pill.height,
  radius: CLEAN_SPEC.radius.pill,
  paddingX: CLEAN_SPEC.sizes.pill.paddingX,
  /** The warning variant: padding 0 8 0 4 so the icon sits closer to the edge. */
  warningPaddingLeft: CLEAN_SPEC.space.s4,
  /** Between the warning icon and the text. */
  warningGap: CLEAN_SPEC.space.s4,
  iconSize: CLEAN_SPEC.icon.size,
  /** s13 at weight 500 (spec 5.6 "s13 med"). */
  fontWeight: '500',
} as const;

type PillTheme = Pick<
  ColorScheme,
  'primary' | 'onPrimary' | 'primaryContainer' | 'error' | 'errorContainer' | 'onSurface'
>;

/** Fill and text colour of a variant, from theme roles only. */
export function pillColors(theme: PillTheme, variant: PillVariant, heroFill?: HeroFill, block?: BlockColors): { fill: string; text: string } {
  if (variant === 'hero' && block && !heroFill) return { fill: block.chip, text: block.onChip };
  if (variant === 'hero') {
    const h = heroColors(
      heroFill
        ? { primary: String(theme[heroFill.fill as keyof PillTheme] ?? theme.primary), onPrimary: String(theme[heroFill.ink as keyof PillTheme] ?? theme.onPrimary) }
        : theme,
    );
    return { fill: h.pill, text: h.strong };
  }
  // Words never take colour: the tint or warning sits on the pill's surface, the words stay ink.
  if (variant === 'warning') return { fill: theme.errorContainer, text: theme.onSurface };
  return { fill: theme.primaryContainer, text: theme.onSurface };
}
