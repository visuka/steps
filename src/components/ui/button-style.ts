/** The Clean+ button (spec 5.8, 10.3), as plain numbers. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

export const BUTTON_STYLE = {
  /** A minimum: grows with large text. Themes may raise it, never lower it (themes/build.ts). */
  minHeight: CLEAN_SPEC.sizes.button.height,
  radius: CLEAN_SPEC.radius.button,
  /** The Food result's "Edit" button. */
  editWidth: CLEAN_SPEC.sizes.button.editWidth,
  /**
   * Disabled: a soft grey pill with a grey label that still reads at 4.5:1
   * (rule: contrast), not the colours at 0.4 opacity, which left white on pale sage.
   * Theme roles, read by button.tsx.
   */
  disabled: { bg: 'surfaceContainerHigh', fg: 'onSurfaceVariant', border: 'outlineVariant' },
  /**
   * A compact text button is a link in the text column: no box of its own, so its
   * word sits on the column's left edge; the hit slop keeps the target 48 dp.
   */
  inline: { paddingVertical: CLEAN_SPEC.space.s4, hitSlop: { top: 12, bottom: 12, left: 12, right: 12 } },
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
