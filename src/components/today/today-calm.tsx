/**
 * Today, in the one look the app keeps: Calm and large (owner, 17 Nov 2026;
 * the other seven looks are archived on the archive/all-looks branch).
 * Big, clear and unhurried. Each card carries a small moving picture of the
 * day (calm-motion.tsx): a walker riding the steps bar, a bowl that fills,
 * a glass of water with a moving surface, a rocking moon, a walker in the
 * Walk row. Every tap, figure and slot is as before; with the phone's
 * "Remove animations" on, the pictures stand still at their final state.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { SpecIcon } from '@/components/ui';
import type { SpecIconName } from '@/components/ui/icon-paths';
import { ActiveTheme, MaxContentWidth, MaxTextScale } from '@/constants/theme';
import type { ThemeFont } from '@/constants/themes/types';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';

import { FoodBowl, GrowBar, SleepMoon, StepsTrack, useCountUp, Walker, WaterGlass } from './calm-motion';
import { dailyQuote } from './model';
import { NewsTicker } from './news-ticker';
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
import { WeatherBesideDate } from './weather-beside-date';

type Weight = 400 | 500 | 600 | 700 | 800;

/** The loaded file of the theme's face nearest the mockup's weight (file names end in _500Medium and so on). */
function face(weight: Weight, numeral = false): string {
  const f = ActiveTheme.fonts;
  const files: ThemeFont[] = numeral ? [f.numeralMedium, f.numeral] : [f.regular, f.medium, f.semibold, f.bold];
  const w = (x: ThemeFont) => Number(/_(\d00)/.exec(x.family)?.[1] ?? 400);
  return files.reduce((best, x) => (Math.abs(w(x) - weight) < Math.abs(w(best) - weight) ? x : best)).family;
}

/** Text at the mockup's size, line height and weight; `caps` is the small tracked label. */
function T({
  size,
  line,
  weight = 400,
  num,
  caps,
  color,
  style,
  lines,
  fit,
  children,
}: {
  size: number;
  line: number;
  weight?: Weight;
  num?: boolean;
  caps?: boolean;
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
          fontFamily: face(weight, num),
          fontSize: size,
          lineHeight: line,
          color,
          fontVariant: ['tabular-nums'],
          includeFontPadding: false,
        },
        caps && { letterSpacing: size * 0.08, textTransform: 'uppercase' },
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

/** How full the glass is: of today's target, or of 8 glasses without one. */
function waterShare(v: TodayView): number {
  const of = v.water.of && v.water.of > 0 ? v.water.of : 8;
  return Math.min(1, Math.max(0, v.water.glasses / of));
}

/** The cards rise into place one after another when Today first draws (a cut with less motion). */
function enter(i: number) {
  return FadeInDown.delay(i * 70).duration(380).reduceMotion(ReduceMotion.System);
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

function Press({
  onPress,
  label,
  style,
  ripple,
  children,
}: {
  onPress: () => void;
  label: string;
  style?: object;
  ripple: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: ripple, foreground: true }}
      style={[{ overflow: 'hidden' }, style]}>
      {children}
    </Pressable>
  );
}

function Avatar({ v, size, fill, ink, weight }: { v: TodayView; size: number; fill: string; ink: string; weight: Weight }) {
  return (
    <Press onPress={v.on.profile} label="Your profile" ripple={`${ink}22`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
      {v.initial ? (
        <T size={16} line={20} weight={weight} color={ink}>
          {v.initial}
        </T>
      ) : (
        <SpecIcon name="person" color={ink} />
      )}
    </Press>
  );
}

function Beside({ v }: { v: TodayView }) {
  return v.weather ? <WeatherBesideDate weather={v.weather} /> : (v.slots.dateExtra ?? null);
}

function LogFood({ v, fill, ink, radius, size, weight }: { v: TodayView; fill: string; ink: string; radius: number; size: number; weight: Weight }) {
  return (
    <Press onPress={v.on.logFood} label="Log food" ripple={`${ink}33`} style={[styles.logFood, { backgroundColor: fill, borderRadius: radius }]}>
      <SpecIcon name="plus" color={ink} size={20} />
      <T size={size} line={24} weight={weight} color={ink}>
        Log food
      </T>
    </Press>
  );
}

/** What follows the tiles: the cards below, or the premium card for the free app. */
function Tail({ v, gutter = 16 }: { v: TodayView; gutter?: number }) {
  return (
    <View style={{ paddingHorizontal: gutter, gap: 16 }}>
      {v.details ? v.slots.below : v.slots.locked}
    </View>
  );
}

/* ───────────────────────── E · Calm and large ───────────────────────── */

export function TodayCalm({ v, look }: { v: TodayView; look: TodayFrameLook }) {
  const theme = useTheme();
  const m = modelsOf(v);
  const d = distanceText(v);
  const L = m.locked;
  const card = { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant, borderWidth: 1, borderRadius: 20 };
  const quiet = theme.onSurfaceVariant;
  const ink = theme.onSurface;
  // The steps and their share count up when Today opens.
  const steps = useCountUp(Math.max(0, v.steps));
  const pct = useCountUp(Math.max(0, v.pct));
  // A small phone or large text (the owner's 360 dp phone at 1.2): tighter, so Today still fits without scrolling.
  const { height, fontScale } = useWindowDimensions();
  const tight = height / Math.max(1, fontScale) < 760;
  const art = tight ? 28 : 32;

  return (
    <View style={[styles.column, { backgroundColor: look.background, paddingHorizontal: 24, gap: tight ? 8 : 12, paddingTop: tight ? 8 : 16 }]}>
      <View style={styles.spread}>
        <View style={{ flex: 1 }}>
          <View style={styles.dateRow}>
            <T size={24} line={32} weight={700} color={ink}>
              {v.dateLabel}
            </T>
            <Beside v={v} />
          </View>
          <T size={18} line={24} color={quiet} lines={1}>
            {dailyQuote(v.dayKey)}
          </T>
        </View>
        <Avatar v={v} size={48} fill={theme.primaryContainer} ink={theme.onPrimaryContainer} weight={700} />
      </View>

      {/* Where Monday to Sunday was: good news moving by (owner, 16 Nov 2026). */}
      {v.news.length ? (
        <NewsTicker
          items={v.news}
          onPress={v.on.news}
          colors={{
            background: theme.surfaceContainerHigh,
            label: theme.primaryContainer,
            labelInk: theme.onPrimaryContainer,
            ink: ink,
            quiet: quiet,
            ripple: `${ink}1A`,
          }}
        />
      ) : null}

      <Animated.View entering={enter(0)}>
      <Pressable
        onPress={v.on.steps}
        accessibilityRole="button"
        accessibilityLabel={v.stepsSpoken}
        android_ripple={{ color: `${ink}14`, foreground: true }}
        style={[card, { paddingHorizontal: 24, paddingVertical: tight ? 12 : 16, overflow: 'hidden' }]}>
        <View style={[styles.spread, { minHeight: 24 }]}>
          <T size={18} line={24} weight={600} color={quiet}>
            Steps today
          </T>
          <T size={18} line={24} weight={700} color={theme.primary}>
            {pct}%
          </T>
        </View>
        <View style={[styles.baseline, { marginTop: 4 }]}>
          <T size={tight ? 44 : 56} line={tight ? 46 : 56} weight={700} color={ink} style={{ letterSpacing: -1 }} lines={1}>
            {formatSteps(steps)}
          </T>
          <T size={18} line={24} color={quiet} lines={1}>
            of {formatSteps(v.goal)} goal
          </T>
        </View>
        {/* The walker rides the bar's leading edge and cheers at the goal. */}
        <StepsTrack share={share(v)} color={theme.steps} track={theme.lane} walker={theme.primary} height={12} figure={22} />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <T size={24} line={28} weight={700} color={ink}>
              {d.value} {d.unit}
            </T>
            <T size={16} line={20} color={quiet}>
              Distance
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T size={24} line={28} weight={700} color={ink}>
              {Math.max(0, Math.round(v.activeMin ?? 0))} min
            </T>
            <T size={16} line={20} color={quiet}>
              Active
            </T>
          </View>
        </View>
      </Pressable>
      </Animated.View>

      {v.slots.walking}

      <Animated.View entering={enter(1)} style={{ flexDirection: 'row', gap: 12 }}>
        <Press onPress={tapFor(v, 'food')} label={m.food.spoken} ripple={`${ink}14`} style={[card, styles.eHalf]}>
          <View style={styles.artRow}>
            <ELabel icon={L ? 'lock' : 'bowl'} text="Food" color={L ? ink : theme.food} />
            {L ? null : <FoodBowl share={m.food.share ?? 0} color={theme.food} container={theme.foodContainer} size={art} />}
          </View>
          <T size={24} line={28} weight={700} color={ink} fit>
            {m.food.value}
          </T>
          {L ? null : (
            <>
              <T size={16} line={24} color={quiet} fit>
                of {v.food.target} kcal
              </T>
              <GrowBar share={m.food.share ?? 0} height={8} color={theme.food} track={theme.foodContainer} delay={150} style={{ marginTop: 8 }} />
            </>
          )}
        </Press>
        <Press onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} ripple={`${ink}14`} style={[card, styles.eHalf]}>
          <View style={styles.artRow}>
            <ELabel icon={L ? 'lock' : 'moon'} text="Sleep" color={L ? ink : theme.sleep} />
            {L ? null : <SleepMoon color={theme.sleep} ground={theme.surfaceContainerLowest} size={art} />}
          </View>
          <T size={24} line={28} weight={700} color={ink} fit>
            {m.sleep.unit ? `${m.sleep.value} ${m.sleep.unit}` : m.sleep.value}
          </T>
          {L ? null : (
            <T size={16} line={24} color={quiet}>
              Last night
            </T>
          )}
        </Press>
      </Animated.View>

      <Animated.View entering={enter(2)}>
      <Press onPress={tapFor(v, 'water')} label={m.water.spoken} ripple={`${ink}14`} style={[card, styles.eWater]}>
        {L ? null : <WaterGlass share={waterShare(v)} color={theme.water} container={theme.waterContainer} width={tight ? 24 : 30} height={tight ? 34 : 42} />}
        <View style={{ flex: 1 }}>
          <ELabel icon={L ? 'lock' : 'drop'} text="Water" color={L ? ink : theme.water} />
          <T size={24} line={28} weight={700} color={ink} fit>
            {L ? m.water.value : v.water.of ? `${v.water.glasses} of ${v.water.of} glasses` : `${v.water.glasses} ${v.water.glasses === 1 ? 'glass' : 'glasses'}`}
          </T>
        </View>
        {L ? null : (
          <Press
            onPress={v.on.addGlass}
            label="Add a glass of water"
            ripple={`${theme.water}22`}
            style={[styles.eGlass, { borderColor: theme.water, backgroundColor: theme.waterContainer }]}>
            <SpecIcon name="plus" color={theme.water} size={20} />
            <T size={18} line={24} weight={700} color={theme.water}>
              1 glass
            </T>
          </Press>
        )}
      </Press>
      </Animated.View>

      <Animated.View entering={enter(3)}>
      <Press onPress={tapFor(v, 'walk')} label={m.walk.spoken} ripple={`${ink}14`} style={[card, styles.eWalk]}>
        <View style={[styles.circle40, { backgroundColor: L ? theme.surfaceContainerHigh : theme.primaryContainer }]}>
          {L ? <SpecIcon name="lock" color={ink} size={20} /> : <Walker size={24} color={theme.onPrimaryContainer} walking={Boolean(v.walk)} />}
        </View>
        <View style={{ flex: 1 }}>
          <T size={18} line={24} weight={600} color={ink} lines={1}>
            {v.walk && !L ? v.walk.title : 'Walk'}
          </T>
          {walkSub(m.walk, v) ? (
            <T size={14} line={20} color={quiet} lines={1}>
              {walkSub(m.walk, v)}
            </T>
          ) : null}
        </View>
        {v.walk && !L ? (
          <T size={18} line={24} weight={700} color={ink}>
            {v.walk.distance.value} {v.walk.distance.unit}
          </T>
        ) : null}
        <SpecIcon name="chevron-right" color={quiet} size={20} />
      </Press>
      </Animated.View>

      <Tail v={v} gutter={0} />
      <LogFood v={v} fill={theme.primary} ink={theme.onPrimary} radius={20} size={18} weight={700} />
    </View>
  );
}

function ELabel({ icon, text, color }: { icon: SpecIconName; text: string; color: string }) {
  return (
    <View style={[styles.iconLabel, { height: 24 }]}>
      <SpecIcon name={icon} color={color} size={20} />
      <T size={16} line={24} weight={600} color={color}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: 16, gap: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  logFood: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circle40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  eHalf: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  artRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  eWater: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eGlass: { height: 48, minWidth: 48, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  eWalk: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
});
