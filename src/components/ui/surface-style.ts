/**
 * The Clean+ card, as plain numbers (spec 5.5 and 10.3), so jest can check
 * them without rendering. Every look reuses this layout; only colours differ.
 */

import type { ViewStyle } from 'react-native';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

export const CARD_LOOK = {
  radius: CLEAN_SPEC.radius.card,
  /** Padding when the card has content, and the gap between its rows. */
  padding: CLEAN_SPEC.space.s16,
  gap: CLEAN_SPEC.space.s16,
  boxShadow: CLEAN_SPEC.shadow.card,
} as const;

/** Spec 10.3: pressed = ink at 8 % on white and tinted surfaces (0x14 of 0xFF). */
export const PRESSED_ALPHA = '14';
/** Spec 10.3: pressed = white at 24 % on accent (0x3D of 0xFF). */
export const PRESSED_ON_ACCENT_ALPHA = '3D';

/** The ripple colour for a surface whose ink is `ink` (#RRGGBB). */
export function pressedColor(ink: string): string {
  return `${ink}${PRESSED_ALPHA}`;
}

/** The ripple colour on an accent-filled surface whose label is `onAccent` (#RRGGBB). */
export function pressedColorOnAccent(onAccent: string): string {
  return `${onAccent}${PRESSED_ON_ACCENT_ALPHA}`;
}

/** Keys that lay out a card's content; the rest of a caller's style belongs on the outer (shadow) layer. */
const CONTENT_KEYS: ReadonlySet<string> = new Set([
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'gap',
  'rowGap',
  'columnGap',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignContent',
]);

/**
 * A card is two layers so its shadow is not clipped: the outer one carries the
 * shadow and the caller's placement (margin, flex, size), the inner one clips
 * and lays out the content. This splits a caller's flattened style between them.
 */
export function splitCardStyle(flat: ViewStyle): { outer: ViewStyle; inner: ViewStyle } {
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    (CONTENT_KEYS.has(key) ? inner : outer)[key] = value;
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}
