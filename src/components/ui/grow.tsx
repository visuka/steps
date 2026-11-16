/**
 * Charts that grow into place (owner, 17 Nov 2026: animations on every
 * screen): bars rise from the floor, rings and bars fill, the macro donut
 * turns in. Once when drawn, then easing to each new value; a cut when the
 * phone asks for less motion (and so in the CI screenshots).
 */

import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Circle, type CircleProps } from 'react-native-svg';

import { standardTiming } from './motion';

/** 0 → `to` when first drawn, then to each new value. */
export function useEase(to: number, ms = 700, delay = 0): SharedValue<number> {
  const v = useSharedValue(0);
  const end = Number.isFinite(to) ? to : 0;
  useEffect(() => {
    v.value = withDelay(delay, withTiming(end, standardTiming(ms)), ReduceMotion.System);
  }, [end, ms, delay, v]);
  return v;
}

/** A bar's fill, `share` (0 to 1) of its track's width. */
export function GrowWidth({ share, style }: { share: number; style?: StyleProp<ViewStyle> }) {
  const g = useEase(Math.min(1, Math.max(0, share)));
  const width = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  return <Animated.View style={[style, width]} />;
}

/** One column of a bar chart, rising to `height` dp; columns follow each other by `index`. */
export function GrowColumn({ height, index = 0, style }: { height: number; index?: number; style?: StyleProp<ViewStyle> }) {
  const g = useEase(height, 600, Math.min(index, 30) * 15);
  const h = useAnimatedStyle(() => ({ height: g.value }));
  return <Animated.View style={[style, h]} />;
}

/** Whatever it holds (an SVG chart) rises from its bottom edge. */
export function GrowUp({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const g = useEase(1, 600);
  const rise = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * g.value, transform: [{ scaleY: g.value }] }));
  return <Animated.View style={[{ transformOrigin: 'bottom' }, style, rise]}>{children}</Animated.View>;
}

/** Turns in a quarter turn as it fades up: for round pictures (the macro donut). */
export function TurnIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const g = useEase(1, 700);
  const turn = useAnimatedStyle(() => ({
    opacity: g.value,
    transform: [{ rotate: `${-90 * (1 - g.value)}deg` }, { scale: 0.85 + 0.15 * g.value }],
  }));
  return <Animated.View style={[style, turn]}>{children}</Animated.View>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring's arc, drawn from its start round to `share` (0 to 1) of the circle. */
export function GrowArc({ share, r, ...circle }: { share: number; r: number } & Omit<CircleProps, 'r' | 'strokeDasharray' | 'strokeDashoffset'>) {
  const c = 2 * Math.PI * r;
  const g = useEase(Math.min(1, Math.max(0, share)), 900);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - g.value) }));
  return <AnimatedCircle {...circle} r={r} strokeDasharray={`${c} ${c}`} animatedProps={props} />;
}
