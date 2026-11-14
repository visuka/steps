/** The extended FAB (spec 5.7 sizes, 10.3 pressed), as plain numbers. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

/**
 * Clearance a screen under the tabs needs so its last content clears the bottom bar's
 * Log-food FAB: the round FAB (56) lifted 7.5 above the bar, plus 16 (T10).
 */
export const BAR_FAB_CLEARANCE = CLEAN_SPEC.sizes.nav.fab + CLEAN_SPEC.sizes.nav.fabLift + CLEAN_SPEC.space.s16;

export const FAB_STYLE = {
  minHeight: CLEAN_SPEC.sizes.nav.fab,
  radius: CLEAN_SPEC.radius.fab,
  boxShadow: CLEAN_SPEC.shadow.fab,
  // The spec draws only the round FAB; the extended one keeps its pre-spec padding, gap and icon size.
  minWidth: 80,
  iconSize: 24,
  gap: CLEAN_SPEC.space.s12,
  paddingLeft: CLEAN_SPEC.space.s16,
  paddingRight: 20,
} as const;
