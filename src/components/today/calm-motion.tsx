/**
 * The small moving pictures on Today (owner, 17 Nov 2026: "I want
 * animations"): a walker, a bowl that fills, a glass of water, a moon with
 * stars, and numbers that count up. Calm, slow movements only, nothing that
 * flashes.
 *
 * They move only while their screen is in view, and stand still at their
 * final state when the phone asks for less motion (Settings → Accessibility →
 * Remove animations), as in the CI emulator. Pictures are hidden from
 * TalkBack: the card around each one already says its figures.
 */

import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '@/components/ui/motion';

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Hidden from TalkBack: the card already says what the picture shows. */
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * 0 → 1 over `ms`, repeated while the screen is in view and motion is
 * allowed: back and forth (`swing`) or 0 → 1 again (a steady flow). Rests at
 * `rest` otherwise.
 */
export function useLoop(ms: number, { swing = true, rest = 0, delay = 0, on = true } = {}): SharedValue<number> {
  const t = useSharedValue(rest);
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const run = on && focused && !reduced;
  useEffect(() => {
    if (!run) {
      cancelAnimation(t);
      t.value = rest;
      return;
    }
    t.value = 0;
    const easing = swing ? Easing.inOut(Easing.sin) : Easing.linear;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: ms, easing }), -1, swing));
    return () => cancelAnimation(t);
  }, [run, ms, swing, rest, delay, t]);
  return t;
}

/** A share 0..1 that grows from nothing when first shown, then eases to each new value. */
export function useGrow(share: number, ms = 900, delay = 0): SharedValue<number> {
  const v = useSharedValue(0);
  const target = clamp01(share);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withTiming(target, { duration: ms, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [target, ms, delay, v]);
  return v;
}

/** A whole number that counts up from 0 when first shown, then to each new value. */
export function useCountUp(target: number, ms = 900): number {
  const reduced = useReducedMotion();
  const end = Number.isFinite(target) ? Math.round(target) : 0;
  const [shown, setShown] = useState(reduced ? end : 0);
  const from = useRef(reduced ? end : 0);
  useEffect(() => {
    if (reduced) {
      from.current = end;
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let id = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const now = Math.round(start + (end - start) * (1 - (1 - p) ** 3));
      from.current = now;
      setShown(now);
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [end, ms, reduced]);
  // With less motion the figure is simply the figure.
  return reduced ? end : shown;
}

/** A bar that fills to `share` from the left. */
export function GrowBar({
  share,
  height,
  color,
  track,
  delay = 0,
  style,
}: {
  share: number;
  height: number;
  color: string;
  track: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGrow(share, 900, delay);
  const fill = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  return (
    <View {...hidden} style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fill]} />
    </View>
  );
}

/* ───────────── The walker ───────────── */

function Limb({
  x,
  y,
  length,
  stroke,
  color,
  t,
  from,
  to,
}: {
  x: number;
  y: number;
  length: number;
  stroke: number;
  color: string;
  t: SharedValue<number>;
  from: number;
  to: number;
}) {
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(t.value, [0, 1], [from, to])}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - stroke / 2,
          top: y,
          width: stroke,
          height: length,
          borderRadius: stroke / 2,
          backgroundColor: color,
          transformOrigin: 'top',
        },
        turn,
      ]}
    />
  );
}

/**
 * A walking figure `size` dp tall: legs and arms swing while `walking`; with
 * `cheer` its arms go up (the goal is met). Still when motion is off.
 */
export function Walker({
  size,
  color,
  walking = true,
  cheer = false,
}: {
  size: number;
  color: string;
  walking?: boolean;
  cheer?: boolean;
}) {
  const t = useLoop(520, { on: walking && !cheer, rest: 0.5 });
  const bob = useLoop(900, { on: cheer });
  const w = Math.round(size * 0.6);
  const stroke = Math.max(2, Math.round(size * 0.1));
  const head = Math.round(size * 0.22);
  const cx = w / 2;
  const shoulder = head + stroke;
  const hip = Math.round(size * 0.56);
  const leg = size - hip - stroke / 2;
  const arm = Math.round(size * 0.3);
  const jump = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * size * 0.08 }] }));
  return (
    <Animated.View {...hidden} style={[{ width: w, height: size }, jump]}>
      <View
        style={{
          position: 'absolute',
          left: cx - head / 2,
          top: 0,
          width: head,
          height: head,
          borderRadius: head / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: cx - stroke / 2,
          top: shoulder - stroke / 2,
          width: stroke,
          height: hip - shoulder + stroke,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
      {cheer ? (
        <>
          <Limb x={cx} y={shoulder} length={arm} stroke={stroke} color={color} t={t} from={145} to={145} />
          <Limb x={cx} y={shoulder} length={arm} stroke={stroke} color={color} t={t} from={-145} to={-145} />
        </>
      ) : (
        <>
          <Limb x={cx} y={shoulder} length={arm} stroke={stroke} color={color} t={t} from={30} to={-30} />
          <Limb x={cx} y={shoulder} length={arm} stroke={stroke} color={color} t={t} from={-30} to={30} />
        </>
      )}
      <Limb x={cx} y={hip} length={leg} stroke={stroke} color={color} t={t} from={-28} to={28} />
      <Limb x={cx} y={hip} length={leg} stroke={stroke} color={color} t={t} from={28} to={-28} />
    </Animated.View>
  );
}

/**
 * The steps bar with the walker riding its leading edge: it walks along as
 * the bar fills, and cheers at the goal.
 */
export function StepsTrack({
  share,
  color,
  track,
  walker,
  height = 12,
  figure = 22,
}: {
  share: number;
  color: string;
  track: string;
  walker: string;
  height?: number;
  figure?: number;
}) {
  const [width, setWidth] = useState(0);
  const g = useGrow(share, 1200);
  const done = share >= 1;
  const w = Math.round(figure * 0.6);
  const fill = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  const ride = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(Math.max(0, g.value * width - w / 2), Math.max(0, width - w)) }],
  }));
  // The figure stands on the bar: its feet sink 2 dp into the top of it.
  return (
    <View {...hidden} style={{ height: figure + height - 2 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height,
          borderRadius: height / 2,
          backgroundColor: track,
          overflow: 'hidden',
        }}>
        <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fill]} />
      </View>
      {width > 0 ? (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, ride]}>
          <Walker size={figure} color={walker} cheer={done} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ───────────── Food: a bowl that fills, steaming once something is eaten ───────────── */

function Steam({ x, color, delay }: { x: number; color: string; delay: number }) {
  const t = useLoop(1800, { swing: false, delay });
  const rise = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.3, 1], [0, 0.7, 0]),
    transform: [{ translateY: -t.value * 8 }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: 6 }, rise]}>
      <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
        <Path d="M4 13 C1 10 7 7 4 4 C2 2 4 1 4 1" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

export function FoodBowl({
  share,
  color,
  container,
  size = 44,
}: {
  share: number;
  color: string;
  container: string;
  size?: number;
}) {
  const g = useGrow(share, 1000, 150);
  const bowlW = size - 4;
  const bowlH = Math.round(size * 0.45);
  const level = useAnimatedStyle(() => ({ height: `${g.value * 100}%` }));
  return (
    <View {...hidden} style={{ width: size, height: size }}>
      {share > 0 ? (
        <>
          <Steam x={size * 0.3} color={color} delay={0} />
          <Steam x={size * 0.55} color={color} delay={900} />
        </>
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: 2,
          bottom: 2,
          width: bowlW,
          height: bowlH,
          borderBottomLeftRadius: bowlH,
          borderBottomRightRadius: bowlH,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: color,
          backgroundColor: container,
          overflow: 'hidden',
          justifyContent: 'flex-end',
        }}>
        <Animated.View style={[{ backgroundColor: color, opacity: 0.85 }, level]} />
      </View>
      <View style={{ position: 'absolute', left: 0, bottom: bowlH, width: size, height: 3, borderRadius: 1.5, backgroundColor: color }} />
    </View>
  );
}

/* ───────────── Water: a glass whose surface moves ───────────── */

export function WaterGlass({
  share,
  color,
  container,
  width = 32,
  height = 44,
}: {
  share: number;
  color: string;
  container: string;
  width?: number;
  height?: number;
}) {
  const g = useGrow(share, 1000, 250);
  const t = useLoop(2400, { swing: false });
  const level = useAnimatedStyle(() => ({ height: `${g.value * 100}%` }));
  const flow = useAnimatedStyle(() => ({ transform: [{ translateX: -t.value * width }] }));
  // One wave period per glass width, drawn twice so it can slide by one width forever.
  const half = width / 2;
  const wave = `M0 4 Q${half / 2} 0 ${half} 4 T${width} 4 T${width + half} 4 T${width * 2} 4 V8 H0 Z`;
  return (
    <View
      {...hidden}
      style={{
        width,
        height,
        borderWidth: 2,
        borderTopWidth: 0,
        borderColor: color,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        backgroundColor: container,
        overflow: 'hidden',
        justifyContent: 'flex-end',
      }}>
      <Animated.View style={level}>
        <Animated.View style={[{ position: 'absolute', top: -6, left: 0, width: width * 2, height: 8 }, flow]}>
          <Svg width={width * 2} height={8} viewBox={`0 0 ${width * 2} 8`}>
            <Path d={wave} fill={color} opacity={0.85} />
          </Svg>
        </Animated.View>
        <View style={{ flex: 1, backgroundColor: color, opacity: 0.85 }} />
      </Animated.View>
    </View>
  );
}

/* ───────────── Sleep: a rocking moon with stars that twinkle ───────────── */

function Star({ x, y, size, color, ms, delay }: { x: number; y: number; size: number; color: string; ms: number; delay: number }) {
  const t = useLoop(ms, { delay, rest: 1 });
  const twinkle = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 1], [0.25, 1]), transform: [{ scale: interpolate(t.value, [0, 1], [0.7, 1]) }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, twinkle]}>
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

export function SleepMoon({ color, ground, size = 44 }: { color: string; ground: string; size?: number }) {
  const t = useLoop(3200, { rest: 0.5 });
  const rock = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(t.value, [0, 1], [-8, 8])}deg` }] }));
  const moon = Math.round(size * 0.6);
  const cut = Math.round(moon * 0.82);
  return (
    <View {...hidden} style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', left: 2, top: size - moon - 2, width: moon, height: moon }, rock]}>
        <View style={{ width: moon, height: moon, borderRadius: moon / 2, backgroundColor: color }} />
        <View
          style={{
            position: 'absolute',
            left: moon * 0.38,
            top: -moon * 0.12,
            width: cut,
            height: cut,
            borderRadius: cut / 2,
            backgroundColor: ground,
          }}
        />
      </Animated.View>
      <Star x={size * 0.62} y={2} size={10} color={color} ms={1600} delay={0} />
      <Star x={size * 0.82} y={size * 0.34} size={7} color={color} ms={2200} delay={500} />
      <Star x={size * 0.5} y={size * 0.3} size={6} color={color} ms={2800} delay={1100} />
    </View>
  );
}
