/**
 * Today in grey, black and one red, after the owner's reference picture
 * (17 Nov 2026; docs/design.md "Current: grey, black and one red"). Top: the
 * avatar, a Nutrition / Activity switch (Nutrition opens Food) and a
 * calendar button; the date, weather and quote under it. The Steps card: a
 * light count, a red line with the time now over dense hour dots (the hour
 * now red and blinking) and a rounded goal bar with its scale. Distance and
 * Active as their own cards, then Food and Sleep under a mono title, water
 * glasses, the walk and Log food. Cards have no outline. Every tap, figure
 * and slot is as before. The drawn pieces are in time-of-day-parts.tsx.
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
import { coloured, Glasses, GoalBar, HourDots, Scale, SleepBar, Track, useCountUp } from './time-of-day-parts';
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

/** A card's head: a 14 icon in grey and its name as a small label; with `more`, a small arrow at the right. */
function Head({ icon, text, color, more }: { icon: SpecIconName; text: string; color: string; more?: string }) {
  return (
    <View style={styles.head}>
      <SpecIcon name={icon} color={color} size={14} />
      <Label text={text} color={color} />
      {more ? (
        <View style={{ marginLeft: 'auto' }}>
          <SpecIcon name="arrow-up-right" color={more} size={14} />
        </View>
      ) : null}
    </View>
  );
}

/** Narrow light numerals for the figures, as in the owner's reference (the phone's own condensed face). */
const CONDENSED = 'sans-serif-condensed';

/** A big light figure with its unit as a small label: "8.1 KM", "7 MIN". */
function Figure({ value, unit, size, p }: { value: string; unit?: string; size: number; p: DayPalette }) {
  return (
    <View style={styles.count}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={MaxTextScale}
        style={{ fontFamily: CONDENSED, fontWeight: '300', fontSize: scaled(size), lineHeight: scaled(size + 4), letterSpacing: -0.5, color: p.text, includeFontPadding: false, flexShrink: 1, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {unit ? <Label text={unit} color={p.muted} style={{ marginBottom: scaled(size / 6) }} /> : null}
    </View>
  );
}

/** The small Active bar is full at 30 active minutes. */
const ACTIVE_BAR_MIN = 30;

/** A card's figure in the narrow face, the unit joined to it at the same size: "4.6km", "52m", "6h 50m" (owner's reference). */
function Amount({ text, size, p }: { text: string; size: number; p: DayPalette }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: CONDENSED, fontWeight: '400', fontSize: scaled(size), lineHeight: scaled(size + 4), letterSpacing: -0.2, color: p.text, includeFontPadding: false, fontVariant: ['tabular-nums'] }}>
      {text}
    </Text>
  );
}

/** "52m", or "2h 24m" from an hour. */
function minutes(n: number): string {
  return n < 60 ? `${n}m` : `${Math.floor(n / 60)}h ${n % 60}m`;
}

/** Distance's bar: pale grey (owner's reference). */
const PALE = '#C8C8C8';

/** Soft shadow under cards and the selected buttons (owner's reference). */
const LIFT = { elevation: 2, shadowColor: '#00000038' } as const;

/** "4.05": one decimal under 10, none above. */
function short(n: number): string {
  return n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
}

/** Distance or Active: its own card with a head and arrow, a light figure and a rounded bar with its scale. */
function Stat({
  icon,
  label,
  value,
  share: s,
  color,
  marks,
  spoken,
  onPress,
  p,
  card,
  tight,
  lean,
}: {
  icon: SpecIconName;
  label: string;
  value: string;
  share: number;
  color: string;
  marks: string[] | undefined;
  spoken: string;
  onPress: () => void;
  p: DayPalette;
  card: object;
  tight: boolean;
  lean: boolean;
}) {
  return (
    <Press onPress={onPress} label={spoken} ripple={`${p.text}14`} style={[card, styles.half]}>
      <Head icon={icon} text={label} color={p.muted} more={p.text} />
      <View style={{ marginTop: tight ? 2 : 4 }}>
        <Amount text={value} size={tight ? 18 : 20} p={p} />
      </View>
      <View style={{ marginTop: tight ? 4 : 6 }}>
        <Track parts={[{ from: 0, to: Math.min(1, Math.max(0, s)), color, dot: false }]} filled={s} p={p} marks={lean ? undefined : marks} />
      </View>
    </Press>
  );
}

/** Today's top row: the avatar, the Nutrition / Activity switch and the calendar. */
function TopBar({ v, p, tight }: { v: TodayView; p: DayPalette; tight: boolean }) {
  const h = tight ? styles.short : null;
  const r = tight ? styles.shortRound : null;
  return (
    <View style={styles.topBar}>
      <Press onPress={v.on.profile} label="Your profile" ripple={`${p.main}22`} style={[styles.round, r, LIFT, { backgroundColor: p.card }]}>
        {v.initial ? (
          <T size={15} line={20} weight={700} color={p.main}>
            {v.initial}
          </T>
        ) : (
          <SpecIcon name="person" color={p.main} />
        )}
      </Press>
      <View accessibilityRole="tablist" style={[styles.switch, h, { backgroundColor: p.edge }]}>
        <Press onPress={v.on.logFood} label="Nutrition, opens Food" ripple={`${p.text}14`} style={styles.switchPart}>
          <Label text="Nutrition" color={p.muted} />
        </Press>
        <View accessible accessibilityRole="tab" accessibilityState={{ selected: true }} accessibilityLabel="Activity, this screen" style={[styles.switchPart, LIFT, { backgroundColor: p.card }]}>
          <Label text="Activity" color={p.text} />
        </View>
      </View>
      <Press onPress={() => v.on.calendar()} label="Calendar: steps by day" ripple={`${p.main}22`} style={[styles.round, r, LIFT, { backgroundColor: p.card }]}>
        <SpecIcon name="calendar" color={p.main} size={18} />
      </Press>
    </View>
  );
}

/** A section's title in big mono capitals, outside the cards: "FOOD & SLEEP". */
function Section({ text, p }: { text: string; p: DayPalette }) {
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: scaled(15), lineHeight: scaled(20), letterSpacing: 1.2, color: p.text, includeFontPadding: false, marginTop: 6 }}>
      {text.toUpperCase()}
    </Text>
  );
}

/** One line: the date, the weather (or the weather offer), then the day's quote. */
function SubLine({ v, p }: { v: TodayView; p: DayPalette }) {
  const extra = v.weather ? null : (v.slots.dateExtra ?? null);
  return (
    <View style={styles.subLine}>
      <T size={15} line={20} weight={700} color={p.text} lines={1} style={{ letterSpacing: -0.2 }}>
        {v.dateLabel}
      </T>
      <T size={13} line={18} color={p.muted}>
        ·
      </T>
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
  // Large text: the optional extras (section title, bar scales) step aside so Today still fits.
  const { fontScale } = useWindowDimensions();
  const tight = height < 820;
  const lean = tight || fontScale > 1.1;
  const gap = 7;
  const padV = tight ? 8 : 9;
  // No outline: soft white cards on the grey ground (owner's reference).
  const card = { backgroundColor: p.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: padV, ...LIFT };
  const steps = useCountUp(Math.max(0, v.steps));
  const range = activeRange(v.hourly, v.nowHour);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const toGo = Math.max(0, v.goal - v.steps);
  const goalMarks = v.goal > 0 ? ['0', ...[1, 2, 3, 4].map((q) => formatSteps(Math.round((v.goal * q) / 4)))] : null;
  const dist = Number(d.value) || 0;
  const s = share(v);
  const distMarks = s > 0 && dist > 0 ? ['0', short(dist / s / 2), `${short(dist / s)} ${d.unit}`] : undefined;
  const past = Math.max(0, v.steps - v.goal);
  const active = Math.max(0, Math.round(v.activeMin ?? 0));
  const foodShare = Math.min(1, Math.max(0, m.food.share ?? 0));
  const foodTarget = Number(String(v.food.target ?? '').replace(/[^0-9.]/g, '')) || 0;
  const foodMarks = foodTarget > 0 ? ['0', formatSteps(foodTarget / 2), formatSteps(foodTarget)] : null;
  const ripple = `${p.text}14`;

  return (
    <View style={[styles.column, { gap }]}>
      <Rise delay={0} duration={700} distance={10} style={{ gap: tight ? 6 : 8 }}>
        <TopBar v={v} p={p} tight={tight} />
        <SubLine v={v} p={p} />
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
            <View style={styles.head}>
              <SpecIcon name="clock" color={p.muted} size={12} />
              <Label text="Today" color={p.muted} />
            </View>
            {range ? <Label text={range.replace('NOW', time)} color={p.muted} /> : null}
          </View>
          <View style={[styles.spread, { alignItems: 'flex-end', marginTop: tight ? 2 : 6 }]}>
            <Figure value={formatSteps(steps)} unit="Steps" size={tight ? 34 : 38} p={p} />
            {past > 0 ? null : <Label text={`${formatSteps(toGo)} to go`} color={p.muted} style={{ marginBottom: scaled(8) }} />}
          </View>
          <View style={{ height: 1, backgroundColor: p.edge, marginTop: tight ? 4 : 8, marginHorizontal: -16 }} />
          <View style={{ marginTop: tight ? 6 : 8 }}>
            <HourDots hourly={v.hourly} nowHour={v.nowHour} p={p} time={time} tight={tight} />
          </View>
          <View style={{ marginTop: tight ? 5 : 8 }}>
            <GoalBar steps={v.steps} goal={v.goal} p={p} />
          </View>
          {past > 0 ? (
            <View style={[styles.spread, { marginTop: tight ? 4 : 6 }]}>
              <Label text={`Goal ${formatSteps(v.goal)}`} color={p.muted} />
              <View style={styles.head}>
                <View style={[styles.square, { backgroundColor: p.accent }]} />
                <Label text={`+${formatSteps(past)} past goal`} color={p.text} />
              </View>
            </View>
          ) : goalMarks ? (
            <Scale marks={goalMarks} />
          ) : null}
        </Pressable>
      </Rise>

      <Rise delay={140} duration={700} distance={10} style={[styles.pair, { gap }]}>
        <Stat
          icon="feet"
          label="Distance"
          value={`${d.value}${d.unit}`}
          share={s}
          color={PALE}
          marks={distMarks}
          spoken={`Distance ${d.value} ${d.unit}`}
          onPress={v.on.steps}
          p={p}
          card={card}
          tight={tight}
          lean={lean}
        />
        <Stat
          icon="clock"
          label="Active"
          value={minutes(active)}
          share={active / ACTIVE_BAR_MIN}
          color={p.accent}
          marks={['0', '15m', `${ACTIVE_BAR_MIN}m`]}
          spoken={`Active ${active} minutes`}
          onPress={v.on.steps}
          p={p}
          card={card}
          tight={tight}
          lean={lean}
        />
      </Rise>

      {v.slots.walking}

      {lean ? null : <Section text="Food & sleep" p={p} />}

      <Rise delay={180} duration={700} distance={10} style={[styles.pair, { gap }]}>
        <Press onPress={tapFor(v, 'food')} label={m.food.spoken} ripple={ripple} style={[card, styles.half]}>
          <Head icon={L ? 'lock' : 'bowl'} text="Food" color={p.muted} more={L ? undefined : p.text} />
          <View style={{ marginTop: tight ? 2 : 4 }}>
            <Amount text={L ? m.food.value : `${m.food.value} kcal`} size={tight ? 18 : 20} p={p} />
          </View>
          {L ? null : (
            <>
              <T size={12} line={16} color={p.muted} fit>
                of {v.food.target} kcal
              </T>
              <View style={{ marginTop: tight ? 2 : 4 }}>
                <Track
                  parts={coloured([{ from: 0, to: foodShare, red: false, dot: false }, { from: foodShare, to: foodShare, red: true, dot: true }], p, p.main)}
                  filled={foodShare}
                  p={p}
                  marker={0}
                  marks={lean || !foodMarks ? undefined : foodMarks}
                />
              </View>
            </>
          )}
        </Press>
        <Press onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} ripple={ripple} style={[card, styles.half]}>
          <Head icon={L ? 'lock' : 'moon'} text="Sleep" color={p.muted} more={L ? undefined : p.text} />
          <View style={{ marginTop: tight ? 2 : 4 }}>
            <Amount text={!L && v.sleep ? `${v.sleep.h}h ${v.sleep.m}m` : m.sleep.value} size={tight ? 18 : 20} p={p} />
          </View>
          {L ? null : (
            <>
              <T size={12} line={16} color={p.muted}>
                Last night
              </T>
              <View style={{ marginTop: tight ? 2 : 4 }}>
                <SleepBar share={m.sleep.share ?? 0} p={p} marks={lean ? undefined : ['0h', '4h', '8h']} />
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
                <Glasses glasses={v.water.glasses} of={v.water.of} color={p.water} fill={p.waterLane} />
              </View>
              <Press
                onPress={v.on.addGlass}
                label="Add a glass of water"
                ripple={`${p.water}22`}
                hitSlop={7}
                style={[styles.plus, { borderColor: p.water, backgroundColor: `${p.water}1F` }]}>
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

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  short: { height: 36 },
  shortRound: { width: 36, height: 36, borderRadius: 18 },
  switch: { height: 40, borderRadius: 20, padding: 3, flexDirection: 'row' },
  switchPart: { paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  subLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 },
  square: { width: 6, height: 6, borderRadius: 1 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plus: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dotTight: { width: 34, height: 34, borderRadius: 17 },
  logFood: { height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
