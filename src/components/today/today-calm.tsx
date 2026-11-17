/**
 * Today in grey, black and one red (owner, 17 Nov 2026; docs/design.md
 * "Current: Today"): the Steps tile shows TODAY with the hours you were on
 * your feet, the count, one column of dots per hour (the hour now red and
 * gently blinking), a segmented goal bar (black to the goal, hatched for
 * what is left, red past it) and small Distance and Active tiles. Then Food
 * and Sleep side by side, water glasses, the walk and Log food. Every tap,
 * figure and slot is as before; only the look changed. The drawn pieces and
 * the motion are in time-of-day-parts.tsx.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';

import { SpecIcon } from '@/components/ui';
import { Rise } from '@/components/ui/rise';
import type { SpecIconName } from '@/components/ui/icon-paths';
import { WeatherIcon } from '@/components/walk/walk-icons';
import type { DayPalette } from '@/constants/day-part';
import { ActiveTheme, MaxContentWidth, MaxTextScale } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';
import type { ThemeFont } from '@/constants/themes/types';
import { useDayPart } from '@/hooks/use-day-part';
import { formatSteps } from '@/lib/format';

import { dailyQuote } from './model';
import { NewsTicker } from './news-ticker';
import { activeRange } from './steps-tile-model';
import { Glasses, GoalBar, HourDots, MiniBar, useCountUp } from './time-of-day-parts';
import {
  foodTile,
  lockedTileModel,
  sleepTile,
  TILE_KINDS,
  type TileKind,
  type TileModel,
  walkTile,
  waterTile,
} from './today-layout';
import type { TodayFrameLook, TodayView } from './view';

type Weight = 400 | 500 | 600 | 700 | 800;

/** The loaded file of the theme's face nearest the mockup's weight (file names end in _500Medium and so on). */
function face(weight: Weight, numeral = false): string {
  const f = ActiveTheme.fonts;
  const files: ThemeFont[] = numeral ? [f.numeralMedium, f.numeral] : [f.regular, f.medium, f.semibold, f.bold];
  const w = (x: ThemeFont) => Number(/_(\d00)/.exec(x.family)?.[1] ?? 400);
  return files.reduce((best, x) => (Math.abs(w(x) - weight) < Math.abs(w(best) - weight) ? x : best)).family;
}

/** Text at the mockup's size, line height and weight. */
function T({
  size,
  line,
  weight = 400,
  color,
  style,
  lines,
  fit,
  children,
}: {
  size: number;
  line: number;
  weight?: Weight;
  color: string;
  style?: TextStyle;
  lines?: number;
  /** One line that shrinks to fit its box (to 70 %) rather than wrap. */
  fit?: boolean;
  children: ReactNode;
}) {
  return (
    <Text
      numberOfLines={fit ? 1 : lines}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.7 : undefined}
      maxFontSizeMultiplier={MaxTextScale}
      style={[
        {
          fontFamily: face(weight),
          // Sizes follow the screen width, as everywhere in the app (ui-scale.ts).
          fontSize: scaled(size),
          lineHeight: scaled(line),
          color,
          fontVariant: ['tabular-nums'],
          includeFontPadding: false,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

function modelsOf(v: TodayView) {
  if (!v.details) {
    const [food, water, sleep, walk] = TILE_KINDS.map(lockedTileModel);
    return { food, water, sleep, walk, locked: true };
  }
  return {
    food: foodTile(v.food),
    water: waterTile(v.water),
    sleep: sleepTile(v.sleep, v.sleepSpoken),
    walk: walkTile(v.walk, v.walkSpoken),
    locked: false,
  };
}

/** Where a row's tap goes: its screen, or the premium card when locked. */
function tapFor(v: TodayView, kind: TileKind): () => void {
  if (!v.details) return v.on.premium;
  return { food: v.on.food, water: v.on.water, sleep: v.on.sleep, walk: v.on.walk }[kind];
}

function share(v: TodayView): number {
  return v.goal > 0 ? Math.min(1, Math.max(0, v.steps / v.goal)) : 0;
}

function distanceText(v: TodayView): { value: string; unit: string } {
  return v.distance && Number(v.distance.value) > 0
    ? { value: v.distance.value, unit: v.distance.unit }
    : { value: '0', unit: v.distance?.unit ?? v.distanceUnit };
}

/** The tail after the walk's start time: "32 min · 3,120 steps", or nothing. */
function walkSub(model: TileModel, v: TodayView): string {
  if (!v.walk) return model.locked ? '' : 'No walk yet today';
  return [v.walk.time, model.note].filter(Boolean).join(' · ');
}

function waterText(v: TodayView, m: TileModel, locked: boolean): string {
  if (locked) return m.value;
  if (v.water.of) return `${v.water.glasses} of ${v.water.of} glasses`;
  return `${v.water.glasses} ${v.water.glasses === 1 ? 'glass' : 'glasses'}`;
}

function Press({
  onPress,
  label,
  style,
  ripple,
  hitSlop,
  children,
}: {
  onPress: () => void;
  label: string;
  style?: object;
  ripple: string;
  hitSlop?: number;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: ripple, foreground: true }}
      hitSlop={hitSlop}
      style={[{ overflow: 'hidden' }, style]}>
      {children}
    </Pressable>
  );
}

/** A small label in tracked monospace capitals: "TODAY", "DISTANCE", "GOAL 7,000". */
function Label({ text, color, style }: { text: string; color: string; style?: TextStyle }) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={MaxTextScale}
      style={[{ fontFamily: 'monospace', fontSize: scaled(11), lineHeight: scaled(14), letterSpacing: 1, color, includeFontPadding: false }, style]}>
      {text.toUpperCase()}
    </Text>
  );
}

/** A card's head: a 14 icon in grey and its name as a small label. */
function Head({ icon, text, color }: { icon: SpecIconName; text: string; color: string }) {
  return (
    <View style={styles.head}>
      <SpecIcon name={icon} color={color} size={14} />
      <Label text={text} color={color} />
    </View>
  );
}

/** The small Active bar is full at 30 active minutes. */
const ACTIVE_BAR_MIN = 30;

/** One of the two small tiles under the goal bar: a label, the figure and a thin bar. */
function Mini({ label, value, share: s, p, tight }: { label: string; value: string; share: number; p: DayPalette; tight: boolean }) {
  return (
    <View style={[styles.mini, { backgroundColor: p.bg }, tight ? { paddingVertical: 6 } : null]}>
      <Label text={label} color={p.muted} />
      <T size={16} line={20} weight={600} color={p.text} style={{ marginTop: tight ? 0 : 2 }} fit>
        {value}
      </T>
      <View style={{ marginTop: tight ? 4 : 6 }}>
        <MiniBar share={s} p={p} />
      </View>
    </View>
  );
}

/** The date's second line: the weather (or the weather offer), then the day's quote. */
function SubLine({ v, p }: { v: TodayView; p: DayPalette }) {
  const extra = v.weather ? null : (v.slots.dateExtra ?? null);
  return (
    <View style={styles.subLine}>
      {v.weather ? (
        <View accessible accessibilityLabel={v.weather.spoken} style={styles.weather}>
          <WeatherIcon condition={v.weather.condition} color={p.muted} size={14} />
          <T size={13} line={18} color={p.muted}>
            {v.weather.text}
          </T>
        </View>
      ) : (
        extra
      )}
      {v.weather || extra ? (
        <T size={13} line={18} color={p.muted}>
          ·
        </T>
      ) : null}
      <T size={13} line={18} color={p.muted} lines={1} style={{ flexShrink: 1 }}>
        {dailyQuote(v.dayKey)}
      </T>
    </View>
  );
}

/** Tail: what follows the tiles, or the premium card for the free app. */
function Tail({ v }: { v: TodayView }) {
  const node = v.details ? v.slots.below : v.slots.locked;
  return node ? <View style={{ gap: 10 }}>{node}</View> : null;
}

export function TodayCalm({ v }: { v: TodayView; look: TodayFrameLook }) {
  const { palette: p } = useDayPart();
  const m = modelsOf(v);
  const d = distanceText(v);
  const L = m.locked;
  // A short screen (360 x 800 and below): tighter, so Today still fits without scrolling (CI run 44063597324).
  const { height } = useWindowDimensions();
  const tight = height < 820;
  const gap = tight ? 8 : 10;
  const padV = tight ? 10 : 12;
  const card = { backgroundColor: p.card, borderColor: p.edge, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: padV };
  const steps = useCountUp(Math.max(0, v.steps));
  const pct = useCountUp(Math.max(0, v.pct));
  const range = activeRange(v.hourly, v.nowHour);
  const past = Math.max(0, v.steps - v.goal);
  const active = Math.max(0, Math.round(v.activeMin ?? 0));
  const ripple = `${p.text}14`;

  return (
    <View style={[styles.column, { gap }]}>
      <Rise delay={0} duration={700} distance={10} style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={22} line={28} weight={700} color={p.text} style={{ letterSpacing: -0.3 }} lines={1}>
            {v.dateLabel}
          </T>
          <SubLine v={v} p={p} />
        </View>
        <Press onPress={v.on.profile} label="Your profile" ripple={`${p.main}22`} style={[styles.avatar, { backgroundColor: p.plate }]}>
          {v.initial ? (
            <T size={15} line={20} weight={700} color={p.main}>
              {v.initial}
            </T>
          ) : (
            <SpecIcon name="person" color={p.main} />
          )}
        </Press>
      </Rise>

      {/* Good news moving by (owner, 16 Nov 2026). */}
      {v.news.length ? (
        <Rise delay={50} duration={700} distance={10}>
          <NewsTicker
            items={v.news}
            onPress={v.on.news}
            colors={{ background: p.newsBg, label: p.card, labelInk: p.main, ink: p.text, quiet: p.muted, ripple: `${p.text}1A` }}
          />
        </Rise>
      ) : null}

      <Rise delay={100} duration={700} distance={10}>
        <Pressable
          onPress={v.on.steps}
          accessibilityRole="button"
          accessibilityLabel={v.stepsSpoken}
          android_ripple={{ color: ripple, foreground: true }}
          style={[card, { overflow: 'hidden' }]}>
          <View style={styles.spread}>
            <Label text="Today" color={p.muted} />
            <View style={styles.head}>
              {range ? <Label text={range} color={p.muted} /> : null}
              <SpecIcon name="chevron-right" color={p.muted} size={14} />
            </View>
          </View>
          <View style={styles.count}>
            <T size={34} line={tight ? 36 : 40} weight={600} color={p.text} style={{ letterSpacing: -0.8, flexShrink: 1 }} fit>
              {formatSteps(steps)}
            </T>
            <Label text="Steps" color={p.muted} style={{ marginBottom: scaled(6) }} />
            <Label text={`${pct}%`} color={p.text} style={{ marginLeft: 'auto', marginBottom: scaled(6) }} />
          </View>
          <View style={{ marginTop: tight ? 6 : 10 }}>
            <HourDots hourly={v.hourly} nowHour={v.nowHour} p={p} gap={tight ? 2 : undefined} />
          </View>
          <View style={styles.axis}>
            {['00', '06', '12', '18'].map((t, i) => (
              <Label key={t} text={t} color={p.muted} style={i < 3 ? { width: `${600 / 23}%` } : { flex: 1 }} />
            ))}
          </View>
          <View style={{ marginTop: tight ? 8 : 12 }}>
            <GoalBar steps={v.steps} goal={v.goal} p={p} />
          </View>
          <View style={[styles.spread, { marginTop: tight ? 4 : 6 }]}>
            <Label text={`Goal ${formatSteps(v.goal)}`} color={p.muted} />
            {past > 0 ? (
              <View style={styles.head}>
                <View style={[styles.square, { backgroundColor: p.accent }]} />
                <Label text={`+${formatSteps(past)} past goal`} color={p.text} />
              </View>
            ) : (
              <Label text={`${formatSteps(Math.max(0, v.goal - v.steps))} to go`} color={p.muted} />
            )}
          </View>
          <View style={[styles.pair, { marginTop: tight ? 6 : 10, gap: 8 }]}>
            <Mini label="Distance" value={`${d.value} ${d.unit}`} share={share(v)} p={p} tight={tight} />
            <Mini label="Active" value={`${active} min`} share={active / ACTIVE_BAR_MIN} p={p} tight={tight} />
          </View>
        </Pressable>
      </Rise>

      {v.slots.walking}

      <Rise delay={180} duration={700} distance={10} style={styles.pair}>
        <Press onPress={tapFor(v, 'food')} label={m.food.spoken} ripple={ripple} style={[card, styles.half]}>
          <Head icon={L ? 'lock' : 'bowl'} text="Food" color={p.muted} />
          <Value value={m.food.value} unit={L ? undefined : 'kcal'} p={p} />
          {L ? null : (
            <>
              <T size={12} line={16} color={p.muted} fit>
                of {v.food.target} kcal
              </T>
              <View style={{ marginTop: tight ? 6 : 10 }}>
                <MiniBar share={m.food.share ?? 0} p={p} />
              </View>
            </>
          )}
        </Press>
        <Press onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} ripple={ripple} style={[card, styles.half]}>
          <Head icon={L ? 'lock' : 'moon'} text="Sleep" color={p.muted} />
          <Value value={m.sleep.value} unit={L ? undefined : m.sleep.unit} p={p} />
          {L ? null : (
            <>
              <T size={12} line={16} color={p.muted}>
                Last night
              </T>
              <View style={{ marginTop: tight ? 6 : 10 }}>
                <MiniBar share={m.sleep.share ?? 0} p={p} />
              </View>
            </>
          )}
        </Press>
      </Rise>

      <Rise delay={240} duration={700} distance={10}>
        <Press onPress={tapFor(v, 'water')} label={m.water.spoken} ripple={ripple} style={[card, styles.row]}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Head icon={L ? 'lock' : 'drop'} text="Water" color={p.muted} />
            <T size={17} line={22} weight={600} color={p.text} style={{ marginTop: 4 }} fit>
              {waterText(v, m.water, L)}
            </T>
          </View>
          {L ? null : (
            <>
              <View style={{ marginLeft: 'auto' }}>
                <Glasses glasses={v.water.glasses} of={v.water.of} color={p.water} />
              </View>
              <Press
                onPress={v.on.addGlass}
                label="Add a glass of water"
                ripple={`${p.water}22`}
                hitSlop={7}
                style={[styles.plus, { borderColor: p.water, backgroundColor: p.waterLane }]}>
                <SpecIcon name="plus" color={p.water} size={18} />
              </Press>
            </>
          )}
        </Press>
      </Rise>

      <Rise delay={300} duration={700} distance={10}>
        <Press onPress={tapFor(v, 'walk')} label={m.walk.spoken} ripple={ripple} style={[card, styles.row, { gap: 12 }]}>
          <View style={[styles.dot, { backgroundColor: p.plate }, tight ? styles.dotTight : null]}>
            <SpecIcon name={L ? 'lock' : 'walker'} color={p.main} size={20} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={14} line={18} weight={600} color={p.text} lines={1}>
              {v.walk && !L ? v.walk.title : 'Walk'}
            </T>
            {walkSub(m.walk, v) ? (
              <T size={12} line={16} color={p.muted} lines={1}>
                {walkSub(m.walk, v)}
              </T>
            ) : null}
          </View>
          {v.walk && !L ? (
            <T size={16} line={20} weight={600} color={p.text}>
              {v.walk.distance.value} {v.walk.distance.unit}
            </T>
          ) : null}
          <SpecIcon name="chevron-right" color={p.muted} size={14} />
        </Press>
      </Rise>

      <Tail v={v} />

      <Rise delay={360} duration={700} distance={10} style={{ marginTop: 'auto' }}>
        <Press onPress={v.on.logFood} label="Log food" ripple={`${p.onMain}33`} style={[styles.logFood, { backgroundColor: p.main }]}>
          <SpecIcon name="plus" color={p.onMain} size={20} />
          <T size={15} line={20} weight={600} color={p.onMain}>
            Log food
          </T>
        </Press>
      </Rise>
    </View>
  );
}

/** A card's figure, 21 bold, with its unit in 13 semibold ("1,280 kcal", "6 h 50 min"). */
function Value({ value, unit, p }: { value: string; unit?: string; p: DayPalette }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={MaxTextScale}
      style={[styles.value, { fontFamily: face(700), fontSize: scaled(21), lineHeight: scaled(26), color: p.text }]}>
      {value}
      {unit ? <Text style={{ fontFamily: face(600), fontSize: scaled(13), letterSpacing: 0 }}> {unit}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  subLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 },
  axis: { flexDirection: 'row', marginTop: 4 },
  mini: { flex: 1, minWidth: 0, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  square: { width: 6, height: 6, borderRadius: 1 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plus: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dotTight: { width: 34, height: 34, borderRadius: 17 },
  logFood: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  value: { marginTop: 6, letterSpacing: -0.3, includeFontPadding: false, fontVariant: ['tabular-nums'] },
});
