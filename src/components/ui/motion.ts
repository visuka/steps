import { Easing, ReduceMotion, useReducedMotion, type WithTimingConfig } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const [a, b, c, d] = Motion.standard;
/** Material standard easing, cubic-bezier(0.2, 0, 0, 1). No bounce, no overshoot. */
export const standardEasing = Easing.bezier(a, b, c, d);
const [da, db, dc, dd] = Motion.standardDecelerate;
export const decelerateEasing = Easing.bezier(da, db, dc, dd);

/**
 * A Material-standard timing. With the phone's "Remove animations" or
 * reduce-motion setting on, Reanimated jumps straight to the end: a cut.
 */
export function standardTiming(duration: number = Motion.duration.medium): WithTimingConfig {
  return { duration, easing: standardEasing, reduceMotion: ReduceMotion.System };
}

/** True when the phone asks for less motion; use it to pick a cut over a move. */
export { useReducedMotion };
