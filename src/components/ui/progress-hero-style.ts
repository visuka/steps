/** The 'block' hero plate (spec 5.3), as plain numbers. The Today hero's chart is composed in T6. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

export const HERO_STYLE = {
  radius: CLEAN_SPEC.radius.hero,
  padding: CLEAN_SPEC.sizes.hero.padding,
} as const;
