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

import { dotGrid, goalTrack, type Part, sleepTrack, STEPS_TILE } from './steps-tile-model';

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
  /** The dot grid: rows, the dot and the gap (the same across and up). */
  dotRows: STEPS_TILE.dotRows,
  dot: 3.5,
  dotGap: 3.5,
  /** Every bar: the goal bar, Distance, Active, Food and Sleep. */
  pill: 10,
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

/** The glasses: `color` outlines, the full ones filled with `fill` (pale water blue on Today). */
export function Glasses({ glasses, of, color, fill }: { glasses: number; of: number | null; color: string; fill?: string }) {
  const { count, full } = glassesOf(glasses, of);
  return (
    <View {...hidden} style={styles.glasses}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.glass, { borderColor: color }]}>
          {i < full ? <View style={[styles.water, { backgroundColor: fill ?? color }]} /> : null}
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

/** The grid's greys: the latest peak, the older ones, the scales (owner's reference). */
const DARK = '#3A3A3A';
const FADED = '#CFCFCF';
const FAINT = '#B0B0B0';
/** Under the filled part of a bar, between its pills. */
const BASE = '#E8E8E8';

/**
 * The day as an even grid of round dots, two columns an hour: wide peaks for
 * the busy spells, the latest dark and the older light, a faint base line for
 * the quiet. Across it near the top, the now line: a red pointer that gently
 * blinks (the screen's one continuous movement), a red hairline and the time.
 */
export function HourDots({ hourly, nowHour, p, time, tight }: { hourly: number[]; nowHour: number; p: DayPalette; time: string; tight?: boolean }) {
  const { n, recent } = dotGrid(hourly, nowHour);
  const blink = useBlink();
  const pulse = useAnimatedStyle(() => ({ opacity: blink.value }));
  const rows = TOD.dotRows;
  const dot = tight ? 3 : TOD.dot;
  const gap = tight ? 2.6 : TOD.dotGap;
  const height = rows * dot + (rows - 1) * gap;
  return (
    <View {...hidden} style={{ height }}>
      <View style={[styles.dots, { height }]}>
        {n.map((k, c) => (
          <View key={c} style={{ gap }}>
            {Array.from({ length: rows }, (_, r) => {
              const up = rows - r;
              const bg = up <= k ? (recent[c] ? DARK : FADED) : up === 1 ? p.edge : 'transparent';
              return <View key={r} style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: bg }} />;
            })}
          </View>
        ))}
      </View>
      <View style={[styles.nowRow, { top: dot + gap + dot / 2 - 6 }]}>
        <Animated.View style={[styles.nowTip, { borderLeftColor: p.accent }, pulse]} />
        <View style={[styles.nowLine, { backgroundColor: p.accent }]} />
        <View style={{ backgroundColor: p.card, paddingLeft: 4 }}>
          <Tick text={time} color={p.muted} />
        </View>
      </View>
    </View>
  );
}

/* ───────────── Bars ───────────── */

/** Faint slanted strokes: what is still to come. */
function Hatch({ p, h }: { p: DayPalette; h: number }) {
  return (
    <View style={[styles.hatch, { height: h, borderRadius: h / 2 }]}>
      {Array.from({ length: 90 }, (_, i) => (
        <View key={i} style={{ width: 1, height: h * 2, marginTop: -h / 2, backgroundColor: p.track, transform: [{ rotate: '35deg' }] }} />
      ))}
    </View>
  );
}

/** A tiny faint triangle over a bar at `at` (0..1): where the figure stands. */
function Marker({ at, w }: { at: number; w: number }) {
  return (
    <View style={styles.markerRow}>
      <View style={[styles.marker, { left: Math.max(0, Math.min(w - 6, at * w - 3)) }]} />
    </View>
  );
}

/** A piece of a bar, ready to draw: a pill or a dot, in `color`. */
export interface TrackPart {
  from: number;
  to: number;
  color: string;
  dot: boolean;
}

/** A bar's model pieces, coloured: black (or `black`) pills, red ones and red dots. */
export function coloured(parts: Part[], p: DayPalette, black: string = p.ringB): TrackPart[] {
  return parts.map((x) => ({ from: x.from, to: x.to, dot: x.dot, color: x.red ? p.accent : black }));
}

/**
 * A rounded bar 10 high: pills and dots over a light base up to `filled`
 * (shown left to right once), faint slanted strokes for the rest; optionally
 * a tiny triangle over it and faint marks under it.
 */
export function Track({ parts, filled, p, marks, marker }: { parts: TrackPart[]; filled: number; p: DayPalette; marks?: string[]; marker?: number }) {
  const [w, setW] = useState(0);
  const h = TOD.pill;
  const g = useGrow(1, 1300, 300);
  const f = clamp01(filled);
  // Each dot sits whole inside the bar; pills keep a small gap, more beside a dot.
  const dotX = (x: number) => Math.max(h / 2, Math.min(w - h / 2, x * w));
  const dots = parts.filter((x) => x.dot).map((x) => dotX(x.from));
  const edge = (x: number, side: 1 | -1) => {
    const px = x * w;
    const near = dots.find((d) => Math.abs(d - px) < h);
    if (near !== undefined) return near + side * (h / 2 + 2);
    return px <= 0.5 || px >= w - 0.5 ? px : px + side * 1.5;
  };
  const end = Math.max(f * w, ...dots.map((d) => d + h / 2));
  const reveal = useAnimatedStyle(() => ({ width: g.value * end }));
  return (
    <View {...hidden}>
      {marker !== undefined && w > 0 ? <Marker at={clamp01(marker)} w={w} /> : null}
      <View style={{ height: h }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <>
            <View style={[styles.track, { left: Math.min(w, end + (end > 0 ? 3 : 0)), right: 0 }]}>
              <Hatch p={p} h={h} />
            </View>
            <Animated.View style={[styles.reveal, { height: h }, reveal]}>
              {f > 0 ? <View style={[styles.base, { width: f * w, height: h, borderRadius: h / 2 }]} /> : null}
              {parts.map((x, i) => {
                if (x.dot) {
                  return <View key={i} style={[styles.piece, { left: dotX(x.from) - h / 2, width: h, height: h, borderRadius: h / 2, backgroundColor: x.color }]} />;
                }
                const a = edge(x.from, 1);
                const b = edge(x.to, -1);
                return b - a < 2 ? null : <View key={i} style={[styles.piece, { left: a, width: b - a, height: h, borderRadius: h / 2, backgroundColor: x.color }]} />;
              })}
            </Animated.View>
          </>
        ) : null}
      </View>
      {marks ? <Scale marks={marks} /> : null}
    </View>
  );
}

/** The goal bar: long black pills to the steps, red dots at the quarters passed, red past the goal, strokes for what is left. */
export function GoalBar({ steps, goal, p }: { steps: number; goal: number; p: DayPalette }) {
  const { filled, parts } = goalTrack(steps, goal);
  return <Track parts={coloured(parts, p)} filled={filled} p={p} />;
}

/** Sleep's bar: two black pills and a red dot at their end, the triangle over it. */
export function SleepBar({ share, p, marks }: { share: number; p: DayPalette; marks?: string[] }) {
  const f = clamp01(share);
  return <Track parts={coloured(sleepTrack(f), p)} filled={f} p={p} marks={marks} marker={f} />;
}

/* ───────────── Scales ───────────── */

/** A small number or time in monospace: a scale mark ("2,000", "15m") or the time on the now line. */
export function Tick({ text, color, size = 10 }: { text: string; color: string; size?: number }) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: 'monospace', fontSize: scaled(size), lineHeight: scaled(size + 2), letterSpacing: 0.5, color, includeFontPadding: false }}>
      {text}
    </Text>
  );
}

/** Faint small marks under a bar, spread from left to right. */
export function Scale({ marks }: { marks: string[] }) {
  return (
    <View {...hidden} style={styles.scale}>
      {marks.map((t, i) => (
        <Tick key={`${i}-${t}`} text={t} color={FAINT} size={9} />
      ))}
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
  water: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '80%' },
  dots: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  nowRow: { position: 'absolute', left: 0, right: 0, height: 12, flexDirection: 'row', alignItems: 'center' },
  nowTip: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  nowLine: { flex: 1, height: 1, opacity: 0.55 },
  track: { position: 'absolute', top: 0, bottom: 0 },
  hatch: { flex: 1, flexDirection: 'row', gap: 3, overflow: 'hidden' },
  reveal: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  base: { position: 'absolute', left: 0, top: 0, backgroundColor: BASE },
  piece: { position: 'absolute', top: 0 },
  markerRow: { height: 4, marginBottom: 3 },
  marker: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: FAINT,
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
