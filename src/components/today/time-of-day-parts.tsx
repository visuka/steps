/**
 * The drawn pieces of the Time-of-day Today (docs/design.md "Current: Today
 * Time of day"): the steps ring, the hour bars, the water glasses, the
 * meters, the steps card's gradient and the wash at the top of the screen,
 * plus the gentle motion (numbers count up, the ring and meters fill, the bars
 * grow, once). With the phone's "Remove animations" on, all of it is drawn at
 * its final state at once. Pictures are hidden from TalkBack: the card around
 * each one already says its figures.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/components/ui/motion';
import type { DayPalette } from '@/constants/day-part';

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Hidden from TalkBack: the card already says what the picture shows. */
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** The sizes of docs/design.md "Layout" that belong to the drawn pieces. */
export const TOD = {
  ring: 92,
  ringRadius: 40,
  ringStroke: 7,
  hoursHeight: 40,
  hourBar: 5,
  glassWidth: 12,
  glassHeight: 18,
  glassGap: 4,
  /** At most this many glasses are drawn. */
  glassesMax: 10,
  meter: 5,
} as const;

/* ───────────── Motion ───────────── */

/** A share 0..1 that grows from nothing when first shown, then eases to each new value. */
export function useGrow(share: number, ms = 900, delay = 0): SharedValue<number> {
  const v = useSharedValue(0);
  const target = clamp01(share);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withTiming(target, { duration: ms, easing: Easing.bezier(0.3, 0.7, 0.2, 1).factory(), reduceMotion: ReduceMotion.System }),
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

/* ───────────── Gradients ───────────── */

/**
 * The steps card's soft diagonal gradient, filling its parent (the card clips
 * it to its corners). The card's size is measured and drawn in exact dp: a
 * "100%" Svg left an undrawn strip on the right and at the bottom (T18 CI).
 */
export function HeroGradient({ p }: { p: DayPalette }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      {...hidden}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: p.heroBottom }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: Math.ceil(width), h: Math.ceil(height) });
      }}>
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="todHero" x1="0" y1="0" x2={size.w} y2={size.h} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={p.heroTop} />
              <Stop offset="1" stopColor={p.heroBottom} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="url(#todHero)" />
        </Svg>
      ) : null}
    </View>
  );
}

/** The wash at the top of the screen: `wash` at the top fading to `bg`. */
export function Wash({ p, height, style }: { p: DayPalette; height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg {...hidden} style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]} width="100%" height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id="todWash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.wash} />
          <Stop offset="1" stopColor={p.bg} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill="url(#todWash)" />
    </Svg>
  );
}

/* ───────────── The ring ───────────── */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The steps ring: a two-colour arc over its track, filling over 1.5 s; `children` sits in the middle. */
export function StepsRing({ share, p, children }: { share: number; p: DayPalette; children: ReactNode }) {
  const { ring, ringRadius: r, ringStroke } = TOD;
  const c = 2 * Math.PI * r;
  const g = useGrow(share, 1500, 200);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - g.value) }));
  return (
    <View style={{ width: ring, height: ring }}>
      <Svg {...hidden} width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="todRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.ringA} />
            <Stop offset="1" stopColor={p.ringB} />
          </LinearGradient>
        </Defs>
        <Circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke={p.track} strokeWidth={ringStroke} />
        {share > 0 ? (
          <AnimatedCircle
            cx={ring / 2}
            cy={ring / 2}
            r={r}
            fill="none"
            stroke="url(#todRing)"
            strokeWidth={ringStroke}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            animatedProps={arc}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

/* ───────────── The hour bars ───────────── */

/** Each hour's bar height: steps against the day's busiest hour; quiet (the minimum) after now or with no steps. */
export function hourHeights(hourly: number[], nowHour: number): { height: number; lit: boolean }[] {
  const hours = Array.from({ length: 24 }, (_, i) => Math.max(0, Number(hourly[i]) || 0));
  const top = Math.max(1, ...hours);
  return hours.map((s, i) => {
    const lit = i <= nowHour && s > 0;
    return { lit, height: lit ? Math.max(TOD.hourBar, Math.round((s / top) * TOD.hoursHeight)) : TOD.hourBar };
  });
}

/** 24 thin bars, one per hour, growing up from the bottom once. */
export function HourBars({ hourly, nowHour, p }: { hourly: number[]; nowHour: number; p: DayPalette }) {
  const [w, setW] = useState(0);
  const g = useGrow(1, 900, 250);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0.001, g.value) }] }));
  const bars = hourHeights(hourly, nowHour);
  const { hoursHeight: h, hourBar: bw } = TOD;
  const step = w > bw ? (w - bw) / 23 : 0;
  return (
    <Animated.View {...hidden} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ height: h, transformOrigin: 'bottom' }, grow]}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="todHours" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={p.ringA} />
              <Stop offset="1" stopColor={p.ringB} />
            </LinearGradient>
          </Defs>
          {bars.map((b, i) => (
            <Rect key={i} x={i * step} y={h - b.height} width={bw} height={b.height} rx={bw / 2} fill={b.lit ? 'url(#todHours)' : p.track} />
          ))}
        </Svg>
      ) : null}
    </Animated.View>
  );
}

/* ───────────── Water glasses ───────────── */

/** How many glasses to draw (one per glass of the target, 8 without one, at most 10) and how many are full. */
export function glassesOf(glasses: number, of: number | null): { count: number; full: number } {
  const count = Math.min(TOD.glassesMax, Math.max(1, of && of > 0 ? Math.round(of) : 8));
  return { count, full: Math.min(count, Math.max(0, Math.round(glasses))) };
}

export function Glasses({ glasses, of, color }: { glasses: number; of: number | null; color: string }) {
  const { count, full } = glassesOf(glasses, of);
  return (
    <View {...hidden} style={styles.glasses}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.glass, { borderColor: color }]}>
          {i < full ? <View style={[styles.water, { backgroundColor: color }]} /> : null}
        </View>
      ))}
    </View>
  );
}

/* ───────────── Meter ───────────── */

/** A thin bar that fills to `share` over 1.3 s, from 350 ms. */
export function Meter({ share, color, track, style }: { share: number; color: string; track: string; style?: StyleProp<ViewStyle> }) {
  const g = useGrow(share, 1300, 350);
  const fill = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  const h = TOD.meter;
  return (
    <View {...hidden} style={[{ height: h, borderRadius: h / 2, backgroundColor: track, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height: h, borderRadius: h / 2, backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  glasses: { flexDirection: 'row', gap: TOD.glassGap },
  glass: {
    width: TOD.glassWidth,
    height: TOD.glassHeight,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
    opacity: 0.9,
  },
  water: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '80%', opacity: 0.8 },
});
