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
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/components/ui/motion';
import type { DayPalette } from '@/constants/day-part';
import { MaxTextScale } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';

import { clusterDots, goalPills, hourDots, type Pill, pillRun, STEPS_TILE } from './steps-tile-model';

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
  /** The hour dots: rows per hour, the dot and the gap between rows. */
  dotRows: STEPS_TILE.dotRows,
  dot: 3,
  dotGap: 1.5,
  /** The goal bar and Sleep's pills: height. */
  goalHeight: 8,
  /** The rounded bars of Distance, Active, Food and Sleep. */
  pill: 8,
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

/* ───────────── Hour dots ───────────── */

/** A pulse that never stops: 1 to 0.3 and back over 1.6 s (still at 1 with "Remove animations" on). */
function useBlink(): SharedValue<number> {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      o.value = 1;
      return;
    }
    const half = { duration: 800, easing: Easing.inOut(Easing.quad) };
    o.value = withRepeat(withSequence(withTiming(0.3, half), withTiming(1, half)), -1, false);
  }, [reduced, o]);
  return o;
}

/**
 * One column of dots per hour, filled from the bottom: grey for steps, faint
 * for none, the hour now in red and gently blinking (the screen's one
 * continuous movement).
 */
export function HourDots({ hourly, nowHour, p, gap }: { hourly: number[]; nowHour: number; p: DayPalette; gap?: number }) {
  const counts = hourDots(hourly, nowHour);
  const blink = useBlink();
  const pulse = useAnimatedStyle(() => ({ opacity: blink.value }));
  const { dotRows: rows, dot } = TOD;
  const dotGap = gap ?? TOD.dotGap;
  // Only the steps are drawn; an hour with none keeps one faint dot on the base line.
  const column = (n: number, color: string, k: number) => (
    <View key={k} style={[styles.dotColumn, { gap: dotGap }]}>
      {Array.from({ length: rows }, (_, r) => {
        const up = rows - r;
        const bg = up <= n ? color : up === 1 ? p.edge : 'transparent';
        return <View key={r} style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: bg }} />;
      })}
    </View>
  );
  const cluster = (n: number, color: string) => clusterDots(n).map((c, k) => column(c, color, k));
  return (
    <View {...hidden} style={[styles.dots, { height: rows * dot + (rows - 1) * dotGap }]}>
      {counts.map((n, i) =>
        i === nowHour ? (
          <Animated.View key={i} style={[styles.cluster, pulse]}>
            {cluster(Math.max(1, n), p.accent)}
          </Animated.View>
        ) : (
          <View key={i} style={styles.cluster}>
            {cluster(n, p.muted)}
          </View>
        ),
      )}
    </View>
  );
}

/* ───────────── Pill runs: the goal bar and Sleep ───────────── */

/** Fine upright grey strokes: what is still to come. */
function Rest({ p, h }: { p: DayPalette; h: number }) {
  return (
    <View style={[styles.pillRest, { height: h, borderRadius: h / 2 }]}>
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={{ width: 1, height: h, backgroundColor: p.track }} />
      ))}
    </View>
  );
}

/**
 * Pills of mixed length, black or red, over `filled` of the bar (growing in
 * once), then the strokes; with `dot`, a red dot at the end of the pills.
 */
export function PillRun({ pills, filled, p, dot, marks }: { pills: Pill[]; filled: number; p: DayPalette; dot?: boolean; marks?: string[] }) {
  const g = useGrow(filled, 1300, 250);
  const grow = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  const h = TOD.goalHeight;
  return (
    <View {...hidden}>
      <View style={[styles.pillTrack, { height: h, borderRadius: h / 2 }]}>
        <Animated.View style={[styles.run, { height: h }, grow]}>
          {pills.map((x, i) => (
            <View key={i} style={{ flex: x.w, minWidth: 2, height: h, borderRadius: h / 2, backgroundColor: x.red ? p.accent : p.ringB }} />
          ))}
          {dot && pills.length ? <View style={{ width: h, height: h, borderRadius: h / 2, backgroundColor: p.accent }} /> : null}
        </Animated.View>
        <Rest p={p} h={h} />
      </View>
      {marks ? <Scale marks={marks} p={p} /> : null}
    </View>
  );
}

/** The goal bar: black pills to the steps with the leading one red, red past the goal, strokes for what is left. */
export function GoalBar({ steps, goal, p }: { steps: number; goal: number; p: DayPalette }) {
  const { filled, pills } = goalPills(steps, goal);
  return <PillRun pills={pills} filled={filled} p={p} />;
}

/** Sleep's bar: black pills with a red dot at their end. */
export function SleepBar({ share, p }: { share: number; p: DayPalette }) {
  const f = clamp01(share);
  return <PillRun pills={pillRun(f, null, false, 2.5)} filled={f} p={p} dot />;
}

/* ───────────── Pill bars, scales and the now line ───────────── */

/** A small number or time in monospace under a bar ("2,000", "15m") or at the end of the now line. */
export function Tick({ text, color }: { text: string; color: string }) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: 'monospace', fontSize: scaled(10), lineHeight: scaled(12), letterSpacing: 0.5, color, includeFontPadding: false }}>
      {text}
    </Text>
  );
}

/** Marks under a bar, spread from left to right. */
export function Scale({ marks, p }: { marks: string[]; p: DayPalette }) {
  return (
    <View {...hidden} style={styles.scale}>
      {marks.map((t, i) => (
        <Tick key={`${i}-${t}`} text={t} color={p.muted} />
      ))}
    </View>
  );
}

/**
 * A rounded bar: `share` filled in `color` (growing in once), the rest as fine
 * grey upright strokes, optionally with marks under it.
 */
export function PillBar({ share, color, p, marks, tip }: { share: number; color: string; p: DayPalette; marks?: string[]; tip?: string }) {
  const g = useGrow(share, 1300, 350);
  const fill = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  const h = TOD.pill;
  return (
    <View {...hidden}>
      <View style={[styles.pillTrack, { height: h, borderRadius: h / 2 }]}>
        <Animated.View style={[styles.pillFill, { height: h, borderRadius: h / 2, backgroundColor: color }, fill]}>
          {tip && share >= 0.15 ? <View style={[styles.tip, { backgroundColor: tip }]} /> : null}
        </Animated.View>
        <Rest p={p} h={h} />
      </View>
      {marks ? <Scale marks={marks} p={p} /> : null}
    </View>
  );
}

/** The red line over the hour dots: a dot, a hairline and the time now ("11:10"). */
export function NowLine({ time, p }: { time: string; p: DayPalette }) {
  return (
    <View {...hidden} style={styles.nowRow}>
      <View style={[styles.nowDot, { backgroundColor: p.accent }]} />
      <View style={[styles.nowLine, { backgroundColor: p.accent, opacity: 0.6 }]} />
      <Tick text={time} color={p.muted} />
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
  dots: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dotColumn: { flexDirection: 'column' },
  cluster: { flexDirection: 'row', gap: 1, alignItems: 'flex-end' },
  run: { flexDirection: 'row', gap: 3, overflow: 'hidden' },
  pillTrack: { flexDirection: 'row', overflow: 'hidden' },
  pillFill: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 2 },
  tip: { width: 4, height: 4, borderRadius: 2 },
  pillRest: { flex: 1, marginLeft: 3, flexDirection: 'row', gap: 2, overflow: 'hidden' },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nowDot: { width: 5, height: 5, borderRadius: 2.5 },
  nowLine: { flex: 1, height: 1 },
});
