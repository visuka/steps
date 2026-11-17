import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from './motion';

const easing = Easing.bezier(0.2, 0.8, 0.2, 1).factory();

/**
 * A block that rises a few dp and fades in once, when first drawn (a cut with
 * the phone's less-motion setting). Only opacity and a shift move: the block's
 * size stays free, so a list that loads a moment later still grows and pushes
 * what is below it down. (Reanimated's `entering` animations froze the block's
 * first size on Fabric: the Chats list overlapped "Coming next", 17 Nov 2026.)
 */
export function Rise({
  delay = 0,
  duration = 320,
  distance = 25,
  style,
  children,
}: {
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration, easing, reduceMotion: ReduceMotion.System }));
    // Once, on first draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const moving = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * distance }] }));
  return <Animated.View style={[style, moving]}>{children}</Animated.View>;
}
