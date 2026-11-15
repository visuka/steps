/** The Today greeting row (spec 5.1), as plain numbers and label builders. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

export const GREETING_STYLE = {
  /** A minimum: grows with large text. */
  minHeight: CLEAN_SPEC.sizes.greeting.height,
  avatar: CLEAN_SPEC.sizes.greeting.avatar,
  /** The date line, and the gap to the weather beside it (spec 5.1). */
  dateHeight: CLEAN_SPEC.sizes.greeting.dateHeight,
  dateGap: CLEAN_SPEC.space.s8,
  /** The weather icon is taller than the date line: it hangs over by half the difference each side. */
  weatherOverhang: (CLEAN_SPEC.icon.size - CLEAN_SPEC.sizes.greeting.dateHeight) / 2,
  avatarRadius: CLEAN_SPEC.radius.circle,
  minTouch: CLEAN_SPEC.sizes.nav.minTouch,
  /** The initial: s15 at 500. */
  initialWeight: '500',
} as const;

/** Hit slop per side that lifts the 40 dp avatar to 48 dp. */
export function avatarHitSlop(): number {
  return Math.max(0, Math.ceil((GREETING_STYLE.minTouch - GREETING_STYLE.avatar) / 2));
}

/** "Good morning, Ravi"; without a name just the greeting. */
export function greetingTitle(greeting: string, name?: string): string {
  const n = name?.trim();
  return n ? `${greeting}, ${n}` : greeting;
}

/** The first letter of the name, upper case, for the avatar. */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '';
}
