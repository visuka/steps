/**
 * Today in "Time of day" colours (owner, 17 Nov 2026; docs/design.md
 * "Current: Today Time of day", mockup docs/design/today-time-of-day.html):
 * Dawn, Noon or Dusk colours by the phone's clock, a steps ring with the
 * day's hour bars, Food and Sleep side by side, water glasses, the walk and
 * Log food. Every tap, figure and slot is as before; only the look changed.
 * The drawn pieces and the gentle motion are in time-of-day-parts.tsx.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SpecIcon } from '@/components/ui';
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
import { Glasses, HeroGradient, HourBars, Meter, rise, StepsRing, useCountUp } from './time-of-day-parts';
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

/** A card's head: an 18 icon in the part's colour and the name, 14 semibold. */
function Head({ icon, text, iconColor, color, chevron }: { icon: SpecIconName; text: string; iconColor: string; color: string; chevron?: string }) {
  return (
    <View style={styles.head}>
      <SpecIcon name={icon} color={iconColor} size={18} />
      <T size={14} line={18} weight={600} color={color}>
        {text}
      </T>
      {chevron ? <SpecIcon name="chevron-right" color={chevron} size={14} /> : null}
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
  // A very short screen: tighter, so Today still fits without scrolling.
  const { height } = useWindowDimensions();
  const tight = height < 740;
  const gap = tight ? 8 : 10;
  const padV = tight ? 10 : 12;
  const card = { backgroundColor: p.card, borderColor: p.edge, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: padV };
  const steps = useCountUp(Math.max(0, v.steps));
  const pct = useCountUp(Math.max(0, v.pct));
  const ripple = `${p.text}14`;

  return (
    <View style={[styles.column, { gap }]}>
      <Animated.View entering={rise(0)} style={styles.top}>
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
      </Animated.View>

      {/* Good news moving by (owner, 16 Nov 2026). */}
      {v.news.length ? (
        <Animated.View entering={rise(50)}>
          <NewsTicker
            items={v.news}
            onPress={v.on.news}
            colors={{ background: p.newsBg, label: p.card, labelInk: p.main, ink: p.text, quiet: p.muted, ripple: `${p.text}1A` }}
          />
        </Animated.View>
      ) : null}

      <Animated.View entering={rise(100)}>
        <Pressable
          onPress={v.on.steps}
          accessibilityRole="button"
          accessibilityLabel={v.stepsSpoken}
          android_ripple={{ color: ripple, foreground: true }}
          style={[card, { backgroundColor: p.heroBottom, borderColor: p.heroEdge, overflow: 'hidden' }]}>
          <HeroGradient p={p} />
          <View style={styles.spread}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Head icon="walker" text="Steps" iconColor={p.main} color={p.text} chevron={p.muted} />
              <T size={40} line={44} weight={700} color={p.text} style={{ letterSpacing: -1.2, marginTop: 4 }} fit>
                {formatSteps(steps)}
              </T>
              <T size={13} line={18} color={p.muted} lines={1}>
                of {formatSteps(v.goal)} goal
              </T>
              <View style={styles.facts}>
                <T size={13} line={18} weight={600} color={p.text}>
                  {d.value} {d.unit}
                </T>
                <T size={13} line={18} color={p.muted}>
                  ·
                </T>
                <T size={13} line={18} weight={600} color={p.text}>
                  {Math.max(0, Math.round(v.activeMin ?? 0))} min
                </T>
                <T size={13} line={18} color={p.muted}>
                  active
                </T>
              </View>
            </View>
            <StepsRing share={share(v)} p={p}>
              <T size={19} line={24} weight={700} color={p.ringB}>
                {pct}%
              </T>
            </StepsRing>
          </View>
          <View style={{ marginTop: 10 }}>
            <HourBars hourly={v.hourly} nowHour={v.nowHour} p={p} />
          </View>
          <View style={styles.axis}>
            {['12 am', '6 am', '12 pm', '6 pm'].map((t) => (
              <T key={t} size={11} line={14} color={p.muted}>
                {t}
              </T>
            ))}
          </View>
        </Pressable>
      </Animated.View>

      {v.slots.walking}

      <Animated.View entering={rise(180)} style={styles.pair}>
        <Press onPress={tapFor(v, 'food')} label={m.food.spoken} ripple={ripple} style={[card, styles.half]}>
          <Head icon={L ? 'lock' : 'bowl'} text="Food" iconColor={L ? p.text : p.food} color={p.text} />
          <Value value={m.food.value} unit={L ? undefined : 'kcal'} p={p} />
          {L ? null : (
            <>
              <T size={12} line={16} color={p.muted} fit>
                of {v.food.target} kcal
              </T>
              <Meter share={m.food.share ?? 0} color={p.food} track={p.foodLane} style={{ marginTop: 10 }} />
            </>
          )}
        </Press>
        <Press onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} ripple={ripple} style={[card, styles.half]}>
          <Head icon={L ? 'lock' : 'moon'} text="Sleep" iconColor={L ? p.text : p.sleep} color={p.text} />
          <Value value={m.sleep.value} unit={L ? undefined : m.sleep.unit} p={p} />
          {L ? null : (
            <>
              <T size={12} line={16} color={p.muted}>
                Last night
              </T>
              <Meter share={m.sleep.share ?? 0} color={p.sleep} track={p.sleepLane} style={{ marginTop: 10 }} />
            </>
          )}
        </Press>
      </Animated.View>

      <Animated.View entering={rise(240)}>
        <Press onPress={tapFor(v, 'water')} label={m.water.spoken} ripple={ripple} style={[card, styles.row]}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Head icon={L ? 'lock' : 'drop'} text="Water" iconColor={L ? p.text : p.water} color={p.text} />
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
      </Animated.View>

      <Animated.View entering={rise(300)}>
        <Press onPress={tapFor(v, 'walk')} label={m.walk.spoken} ripple={ripple} style={[card, styles.row, { gap: 12 }]}>
          <View style={[styles.dot, { backgroundColor: p.plate }]}>
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
      </Animated.View>

      <Tail v={v} />

      <Animated.View entering={rise(360)} style={{ marginTop: 'auto' }}>
        <Press onPress={v.on.logFood} label="Log food" ripple={`${p.onMain}33`} style={[styles.logFood, { backgroundColor: p.main }]}>
          <SpecIcon name="plus" color={p.onMain} size={20} />
          <T size={15} line={20} weight={600} color={p.onMain}>
            Log food
          </T>
        </Press>
      </Animated.View>
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
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, marginTop: 6 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingRight: 30 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plus: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logFood: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  value: { marginTop: 6, letterSpacing: -0.3, includeFontPadding: false, fontVariant: ['tabular-nums'] },
});
