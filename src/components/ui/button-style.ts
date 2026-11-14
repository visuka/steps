/** The Clean+ button (spec 5.8, 10.3), as plain numbers. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

export const BUTTON_STYLE = {
  /** A minimum: grows with large text. Themes may raise it, never lower it (themes/build.ts). */
  minHeight: CLEAN_SPEC.sizes.button.height,
  radius: CLEAN_SPEC.radius.button,
  /** The Food result's "Edit" button. */
  editWidth: CLEAN_SPEC.sizes.button.editWidth,
  /** Disabled: the same colours at 0.4 opacity, nothing else (10.3). */
  disabledOpacity: 0.4,
  paddingHorizontal: CLEAN_SPEC.space.s24,
  paddingVertical: CLEAN_SPEC.space.s8,
  iconSize: CLEAN_SPEC.icon.size,
  iconGap: CLEAN_SPEC.space.s8,
} as const;

export type ButtonKind = 'filled' | 'tonal' | 'secondary' | 'outlined' | 'text';

/** Which pressed ripple a button gets: white at 24 % on an accent fill, ink at 8 % elsewhere. */
export function rippleKind(kind: ButtonKind): 'onAccent' | 'onSurface' {
  return kind === 'filled' ? 'onAccent' : 'onSurface';
}
