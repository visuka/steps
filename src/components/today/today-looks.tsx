/**
 * Today as drawn in the looks' own mockups (App look options: D Colour blocks,
 * E Calm and large, F Sport data). Same figures, taps and slots as the Clean+
 * Today (today-clean.tsx); only the drawing differs (owner, 16 Nov 2026: "do
 * not remove any feature, only their presentation changes"). Sizes, weights
 * and line heights are the mockup's, in dp.
 *
 * Kept from Clean+ in every look: the greeting and avatar, the weather beside
 * the date, the week (F draws it as the 7-day bars in the black block), the
 * hour chart (in the steps block), the walk in progress, the one-time note and
 * everything under the tiles, the locked tiles and premium card.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SpecIcon, WeekStrip } from '@/components/ui';
import type { SpecIconName } from '@/components/ui/icon-paths';
import { ActiveTheme, MaxContentWidth, MaxTextScale } from '@/constants/theme';
import type { ThemeFont } from '@/constants/themes/types';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';

import { dailyQuote } from './model';
import {
  foodTile,
  lockedTileModel,
  pipsFor,
  selectedDay,
  sleepTile,
  TILE_KINDS,
  type TileKind,
  type TileModel,
  walkTile,
  waterTile,
  weekShares,
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
  children: ReactNode;
}) {
  return (
    <Text
      numberOfLines={lines}
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

/** "1,760 to go" figure: never below zero. */
function toGo(v: TodayView): string {
  return formatSteps(Math.max(0, v.goal - v.steps));
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

/** F's calendar button icon, as the mockup's (not one of the spec section 8 icons). */
function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <Path d="M4 10h16M9 3v4M15 3v4" />
    </Svg>
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

/* ───────────────────────── F · Sport data ───────────────────────── */

const F_ROW_ICON: Record<TileKind, SpecIconName> = { food: 'bowl', water: 'drop', sleep: 'moon', walk: 'walker' };

export function TodaySport({ v, look }: { v: TodayView; look: TodayFrameLook }) {
  const theme = useTheme();
  const b = ActiveTheme.block!;
  const m = modelsOf(v);
  const ink = theme.onSurface;
  const quiet = theme.onSurfaceVariant;
  const rule = theme.outlineVariant;
  const d = distanceText(v);
  const segments = 8;
  const filled = share(v) * segments;

  // This week, Monday to Sunday: the average of the days gone by with steps, today in orange.
  const past = v.week.filter((x) => !x.today && !x.future && x.steps > 0);
  const avg = past.length ? past.reduce((s, x) => s + x.steps, 0) / past.length : 0;
  const scale = (steps: number) => {
    const ref = avg > 0 ? avg : v.goal;
    return ref > 0 ? Math.min(40, Math.round((steps / ref) * 32)) : 0;
  };

  const label = (text: string, color = b.quiet) => (
    <T size={12} line={16} weight={600} caps color={color}>
      {text}
    </T>
  );

  return (
    <View style={[styles.column, { backgroundColor: look.background }]}>
      {/* Header: the day's line over the date, the calendar and you. */}
      <View style={[styles.fHeader, { paddingHorizontal: 16 }]}>
        <View style={{ flex: 1 }}>
          <T size={13} line={18} weight={500} color={quiet} lines={1}>
            {dailyQuote(v.dayKey)}
          </T>
          <View style={styles.dateRow}>
            <T size={20} line={24} weight={600} color={ink}>
              {v.dateLabel}
            </T>
            <Beside v={v} />
          </View>
        </View>
        <View style={styles.headButtons}>
          <Press
            onPress={() => v.on.calendar(v.week[selectedDay(v.week)]?.key)}
            label="Calendar"
            ripple={`${ink}1A`}
            style={[styles.fSquare, { borderColor: rule }]}>
            <CalendarIcon color={ink} />
          </Press>
          <Avatar v={v} size={48} fill={theme.surfaceContainerHigh} ink={ink} weight={600} />
        </View>
      </View>

      {/* The black block. */}
      <Pressable
        onPress={v.on.steps}
        accessibilityRole="button"
        accessibilityLabel={v.stepsSpoken}
        android_ripple={{ color: '#FFFFFF22', foreground: true }}
        style={[styles.fBlock, { backgroundColor: b.plate }]}>
        <View style={styles.fHeroTop}>
          <View style={{ gap: 4, flexShrink: 1 }}>
            {label('Steps')}
            <View style={styles.baseline}>
              <T size={64} line={64} weight={600} num color={b.text}>
                {formatSteps(Math.max(0, v.steps))}
              </T>
              <T size={20} line={24} weight={500} num color={b.quiet}>
                / {formatSteps(v.goal)}
              </T>
            </View>
          </View>
          <View style={[styles.fChip, { backgroundColor: b.chip }]}>
            <T size={20} line={24} weight={600} num color={b.onChip}>
              {Math.max(0, Math.round(v.pct))}%
            </T>
          </View>
        </View>

        <View style={styles.split}>
          {Array.from({ length: segments }, (_, i) => {
            const part = Math.min(1, Math.max(0, filled - i));
            return (
              <View key={i} style={[styles.segment, { backgroundColor: part >= 1 ? b.mark : b.lane }]}>
                {part > 0 && part < 1 ? <View style={{ width: `${part * 100}%`, height: 8, backgroundColor: b.mark }} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.fStats}>
          {[
            { value: d.value, label: d.unit },
            { value: String(Math.max(0, Math.round(v.activeMin ?? 0))), label: 'Active min' },
            { value: toGo(v), label: 'To go' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.fStat, i > 0 && { borderLeftWidth: 1, borderLeftColor: b.rule, paddingLeft: 16 }]}>
              <T size={32} line={32} weight={500} num color={b.text} lines={1}>
                {s.value}
              </T>
              {label(s.label)}
            </View>
          ))}
        </View>

        <View style={[styles.fSection, { borderTopColor: b.rule }]}>
          <View style={styles.spread}>
            {label('This week')}
            {avg > 0 ? label(`Avg ${formatSteps(Math.round(avg))}`) : null}
          </View>
          <View style={styles.weekBars}>
            {avg > 0 ? <View style={[styles.avgLine, { borderTopColor: b.average }]} /> : null}
            {v.week.map((day) => (
              <Pressable
                key={day.key}
                disabled={day.future}
                onPress={() => v.on.calendar(day.key)}
                accessibilityRole="button"
                accessibilityLabel={`${day.name}, ${formatSteps(day.steps)} steps`}
                style={styles.weekCol}>
                <View
                  style={{
                    height: day.future ? 0 : Math.max(day.steps > 0 ? 2 : 0, scale(day.steps)),
                    borderRadius: 2,
                    backgroundColor: day.today ? b.mark : day.steps >= avg ? b.barHigh : b.barLow,
                  }}
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.weekLetters}>
            {v.week.map((day) => (
              <T key={day.key} size={12} line={16} weight={600} color={day.today ? b.text : b.quiet} style={styles.center}>
                {day.letter}
              </T>
            ))}
          </View>
        </View>
      </Pressable>

      {v.slots.walking ? <View style={styles.fInset}>{v.slots.walking}</View> : null}

      {/* The list. */}
      <View style={styles.fInset}>
        {(['food', 'water', 'sleep', 'walk'] as const).map((kind) => {
          const model = m[kind];
          const isWalk = kind === 'walk';
          return (
            <Press
              key={kind}
              onPress={tapFor(v, kind)}
              label={model.spoken}
              ripple={`${ink}14`}
              style={[styles.fRow, { minHeight: kind === 'water' && !m.locked ? 72 : isWalk ? 56 : 64, borderBottomColor: rule }]}>
              <View style={[styles.fIcon, { backgroundColor: isWalk && !m.locked ? ink : theme.surfaceContainerHigh }]}>
                <SpecIcon name={m.locked ? 'lock' : F_ROW_ICON[kind]} color={isWalk && !m.locked ? theme.surface : ink} size={22} />
              </View>
              <View style={{ flex: 1, gap: kind === 'water' ? 4 : 0 }}>
                {isWalk ? (
                  <>
                    <T size={15} line={24} weight={600} color={ink} lines={1}>
                      {v.walk && !m.locked ? v.walk.title : 'Walk'}
                    </T>
                    {walkSub(model, v) ? label(walkSub(model, v), quiet) : null}
                  </>
                ) : (
                  <>
                    {label(model.label, quiet)}
                    <FigureLine kind={kind} model={model} v={v} ink={ink} quiet={quiet} />
                    {kind === 'water' && !m.locked ? <WaterPips v={v} on={ink} off={rule} /> : null}
                  </>
                )}
              </View>
              {m.locked ? (
                <SpecIcon name="chevron-right" color={quiet} size={18} />
              ) : kind === 'food' ? (
                <View style={[styles.fFoodBar, { backgroundColor: rule }]}>
                  <View style={{ width: `${(model.share ?? 0) * 100}%`, height: 6, backgroundColor: ink }} />
                </View>
              ) : kind === 'water' ? (
                <Press onPress={v.on.addGlass} label="Add a glass of water" ripple={`${ink}1A`} style={[styles.fGlass, { borderColor: ink }]}>
                  <SpecIcon name="plus" color={ink} size={18} />
                  <T size={15} line={24} weight={600} color={ink}>
                    1 glass
                  </T>
                </Press>
              ) : kind === 'sleep' ? (
                label('Last night', quiet)
              ) : (
                <View style={styles.rowEnd}>
                  {v.walk ? (
                    <View style={styles.baselineTight}>
                      <T size={20} line={24} weight={500} num color={ink}>
                        {v.walk.distance.value}
                      </T>
                      <T size={15} line={24} color={quiet}>
                        {v.walk.distance.unit}
                      </T>
                    </View>
                  ) : null}
                  <SpecIcon name="chevron-right" color={quiet} size={18} />
                </View>
              )}
            </Press>
          );
        })}
      </View>

      <Tail v={v} />
      <View style={{ paddingHorizontal: 16 }}>
        <LogFood v={v} fill={b.chip} ink={b.onChip} radius={12} size={15} weight={600} />
      </View>
    </View>
  );
}

/** F's figure line: the number in Oswald, the rest in the UI face, grey. */
function FigureLine({ kind, model, v, ink, quiet }: { kind: TileKind; model: TileModel; v: TodayView; ink: string; quiet: string }) {
  const n = (s: string) => (
    <T size={20} line={24} weight={500} num color={ink}>
      {s}
    </T>
  );
  const w = (s: string) => (
    <T size={15} line={24} color={quiet}>
      {s}
    </T>
  );
  if (model.locked) return w(model.value);
  if (kind === 'food') return <View style={styles.baselineTight}>{n(model.value)}{w(`/ ${v.food.target} kcal`)}</View>;
  if (kind === 'water')
    return (
      <View style={styles.baselineTight}>
        {n(String(v.water.glasses))}
        {w(v.water.of ? `/ ${v.water.of} glasses` : v.water.glasses === 1 ? 'glass' : 'glasses')}
      </View>
    );
  if (kind === 'sleep' && v.sleep)
    return (
      <View style={styles.baselineTight}>
        {n(String(v.sleep.h))}
        {w('h')}
        {n(String(v.sleep.m))}
        {w('m')}
      </View>
    );
  return w(model.unit ? `${model.value} ${model.unit}` : model.value);
}

function WaterPips({ v, on, off, width = 120, height = 4 }: { v: TodayView; on: string; off: string; width?: number; height?: number }) {
  const p = pipsFor(v.water.glasses, v.water.of);
  return (
    <View style={{ flexDirection: 'row', gap: 3, width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: p.total }, (_, i) => (
        <View key={i} style={{ flex: 1, borderRadius: 1, backgroundColor: i < p.filled ? on : off }} />
      ))}
    </View>
  );
}

/** What follows the tiles in every look: the one-time note, the cards below, the premium card. */
function Tail({ v, gutter = 16 }: { v: TodayView; gutter?: number }) {
  return (
    <View style={{ paddingHorizontal: gutter, gap: 16 }}>
      {v.details ? (
        <>
          {v.slots.note()}
          {v.slots.below}
        </>
      ) : (
        v.slots.locked
      )}
    </View>
  );
}

/* ───────────────────────── D · Colour blocks ───────────────────────── */

export function TodayBlocks({ v, look }: { v: TodayView; look: TodayFrameLook }) {
  const theme = useTheme();
  const m = modelsOf(v);
  const d = distanceText(v);
  const white = theme.surfaceContainerLowest;
  const leaf = theme.onStepsContainer;
  const L = m.locked;

  return (
    <View style={[styles.column, { backgroundColor: look.background, paddingHorizontal: 16, gap: 8, paddingTop: 24 }]}>
      <View style={[styles.spreadEnd, { marginBottom: 8 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.dateRow}>
            <T size={16} line={20} weight={500} color={theme.onSurfaceVariant}>
              {v.dateLabel}
            </T>
            <Beside v={v} />
          </View>
          <T size={22} line={28} weight={800} color={theme.onSurface} lines={1} style={{ letterSpacing: -0.3 }}>
            {dailyQuote(v.dayKey)}
          </T>
        </View>
        <Avatar v={v} size={48} fill={theme.sleepContainer} ink={theme.onSleepContainer} weight={800} />
      </View>

      <WeekStrip days={weekShares(v.week, v.goal)} selectedIndex={selectedDay(v.week)} onSelect={(i) => v.on.calendar(v.week[i]?.key)} />

      <Pressable
        onPress={v.on.steps}
        accessibilityRole="button"
        accessibilityLabel={v.stepsSpoken}
        android_ripple={{ color: `${leaf}22`, foreground: true }}
        style={[styles.dTile, { backgroundColor: theme.stepsContainer, padding: 24, overflow: 'hidden' }]}>
        <View style={[styles.spread, { height: 24 }]}>
          <View style={styles.iconLabel}>
            <SpecIcon name="walker" color={leaf} size={18} />
            <T size={16} line={24} weight={700} color={leaf}>
              Steps
            </T>
          </View>
          <View style={[styles.dChip, { backgroundColor: white }]}>
            <T size={13} line={24} weight={800} color={leaf}>
              {Math.max(0, Math.round(v.pct))}%
            </T>
          </View>
        </View>
        <View style={[styles.baseline, { marginTop: 8 }]}>
          <T size={48} line={52} weight={800} color={leaf} style={{ letterSpacing: -1 }}>
            {formatSteps(Math.max(0, v.steps))}
          </T>
          <T size={16} line={20} weight={500} color={leaf}>
            of {formatSteps(v.goal)}
          </T>
        </View>
        <View style={[styles.track, { height: 16, borderRadius: 8, backgroundColor: white, marginTop: 16 }]}>
          <View style={{ width: `${share(v) * 100}%`, height: 16, borderRadius: 8, backgroundColor: theme.steps }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 32, marginTop: 16 }}>
          <View>
            <T size={20} line={24} weight={800} color={leaf}>
              {d.value} {d.unit}
            </T>
            <T size={13} line={16} weight={500} color={leaf}>
              Distance
            </T>
          </View>
          <View style={{ width: 1, backgroundColor: `${theme.steps}66` }} />
          <View>
            <T size={20} line={24} weight={800} color={leaf}>
              {Math.max(0, Math.round(v.activeMin ?? 0))} min
            </T>
            <T size={13} line={16} weight={500} color={leaf}>
              Active
            </T>
          </View>
        </View>
      </Pressable>

      {v.slots.walking}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Press
          onPress={tapFor(v, 'food')}
          label={m.food.spoken}
          ripple={`${theme.onFoodContainer}22`}
          style={[styles.dTile, styles.dHalf, { backgroundColor: L ? theme.surfaceContainerHigh : theme.foodContainer }]}>
          <DLabel icon={L ? 'lock' : 'bowl'} text="Food" color={L ? theme.onSurface : theme.onFoodContainer} />
          <T size={28} line={32} weight={800} color={L ? theme.onSurface : theme.onFoodContainer} style={{ marginTop: 8 }}>
            {m.food.value}
          </T>
          <T size={13} line={16} weight={500} color={L ? theme.onSurfaceVariant : theme.onFoodContainer}>
            {L ? '' : `of ${v.food.target} kcal`}
          </T>
          {L ? null : (
            <View style={[styles.track, { height: 8, borderRadius: 4, backgroundColor: white, marginTop: 'auto' }]}>
              <View style={{ width: `${(m.food.share ?? 0) * 100}%`, height: 8, borderRadius: 4, backgroundColor: theme.food }} />
            </View>
          )}
        </Press>
        <Press
          onPress={tapFor(v, 'water')}
          label={m.water.spoken}
          ripple={`${theme.onWaterContainer}22`}
          style={[styles.dTile, styles.dHalf, { backgroundColor: L ? theme.surfaceContainerHigh : theme.waterContainer }]}>
          <DLabel icon={L ? 'lock' : 'drop'} text="Water" color={L ? theme.onSurface : theme.onWaterContainer} />
          {L ? (
            <T size={28} line={32} weight={800} color={theme.onSurface} style={{ marginTop: 8 }}>
              {m.water.value}
            </T>
          ) : (
            <>
              <View style={[styles.baselineTight, { marginTop: 8 }]}>
                <T size={28} line={32} weight={800} color={theme.onWaterContainer}>
                  {v.water.glasses}
                </T>
                {v.water.of ? (
                  <T size={16} line={20} weight={700} color={theme.onWaterContainer}>
                    of {v.water.of}
                  </T>
                ) : null}
              </View>
              <T size={13} line={16} weight={500} color={theme.onWaterContainer}>
                {v.water.glasses === 1 && !v.water.of ? 'glass' : 'glasses'}
              </T>
              <Press onPress={v.on.addGlass} label="Add a glass of water" ripple={`${theme.onWaterContainer}22`} style={[styles.dGlass, { backgroundColor: white }]}>
                <SpecIcon name="plus" color={theme.onWaterContainer} size={18} />
                <T size={16} line={20} weight={800} color={theme.onWaterContainer}>
                  1 glass
                </T>
              </Press>
            </>
          )}
        </Press>
      </View>

      <Press
        onPress={tapFor(v, 'sleep')}
        label={m.sleep.spoken}
        ripple={`${theme.onSleepContainer}22`}
        style={[styles.dTile, styles.dRow, { backgroundColor: L ? theme.surfaceContainerHigh : theme.sleepContainer, padding: 16 }]}>
        <View style={[styles.circle48, { backgroundColor: white }]}>
          <SpecIcon name={L ? 'lock' : 'moon'} color={L ? theme.onSurface : theme.onSleepContainer} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={13} line={16} weight={700} color={L ? theme.onSurface : theme.onSleepContainer}>
            Sleep
          </T>
          <T size={20} line={24} weight={800} color={L ? theme.onSurface : theme.onSleepContainer}>
            {m.sleep.unit ? `${m.sleep.value} ${m.sleep.unit}` : m.sleep.value}
          </T>
        </View>
        {L ? null : (
          <T size={13} line={16} weight={500} color={theme.onSleepContainer}>
            Last night
          </T>
        )}
      </Press>

      <Press
        onPress={tapFor(v, 'walk')}
        label={m.walk.spoken}
        ripple={`${theme.onSurface}14`}
        style={[styles.dTile, styles.dRow, { borderWidth: 1, borderColor: theme.surfaceVariant, paddingVertical: 8, paddingLeft: 8, paddingRight: 16 }]}>
        <View style={[styles.circle48, { backgroundColor: L ? theme.surfaceContainerHigh : theme.stepsContainer }]}>
          <SpecIcon name={L ? 'lock' : 'walker'} color={L ? theme.onSurface : leaf} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={16} line={20} weight={700} color={theme.onSurface} lines={1}>
            {v.walk && !L ? v.walk.title : 'Walk'}
          </T>
          {walkSub(m.walk, v) ? (
            <T size={13} line={16} weight={500} color={theme.onSurfaceVariant} lines={1}>
              {walkSub(m.walk, v)}
            </T>
          ) : null}
        </View>
        {v.walk && !L ? (
          <T size={16} line={20} weight={800} color={theme.onSurface}>
            {v.walk.distance.value} {v.walk.distance.unit}
          </T>
        ) : null}
        <SpecIcon name="chevron-right" color={theme.onSurfaceVariant} size={18} />
      </Press>

      <Tail v={v} gutter={0} />
      <LogFood v={v} fill={theme.primary} ink={theme.onPrimary} radius={28} size={16} weight={800} />
    </View>
  );
}

function DLabel({ icon, text, color }: { icon: SpecIconName; text: string; color: string }) {
  return (
    <View style={styles.iconLabel}>
      <SpecIcon name={icon} color={color} size={18} />
      <T size={16} line={24} weight={700} color={color}>
        {text}
      </T>
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

  return (
    <View style={[styles.column, { backgroundColor: look.background, paddingHorizontal: 24, gap: 16, paddingTop: 16 }]}>
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

      <WeekStrip days={weekShares(v.week, v.goal)} selectedIndex={selectedDay(v.week)} onSelect={(i) => v.on.calendar(v.week[i]?.key)} />

      <Pressable
        onPress={v.on.steps}
        accessibilityRole="button"
        accessibilityLabel={v.stepsSpoken}
        android_ripple={{ color: `${ink}14`, foreground: true }}
        style={[card, { padding: 24, overflow: 'hidden' }]}>
        <View style={[styles.spread, { minHeight: 24 }]}>
          <T size={18} line={24} weight={600} color={quiet}>
            Steps today
          </T>
          <T size={18} line={24} weight={700} color={theme.primary}>
            {Math.max(0, Math.round(v.pct))}%
          </T>
        </View>
        <T size={72} line={72} weight={700} color={ink} style={{ marginTop: 8, letterSpacing: -1 }} lines={1}>
          {formatSteps(Math.max(0, v.steps))}
        </T>
        <T size={18} line={24} color={quiet}>
          of {formatSteps(v.goal)} goal
        </T>
        <View style={[styles.track, { height: 16, borderRadius: 8, backgroundColor: theme.lane, marginTop: 16 }]}>
          <View style={{ width: `${share(v) * 100}%`, height: 16, borderRadius: 8, backgroundColor: theme.steps }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <T size={24} line={32} weight={700} color={ink}>
              {d.value} {d.unit}
            </T>
            <T size={16} line={24} color={quiet}>
              Distance
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T size={24} line={32} weight={700} color={ink}>
              {Math.max(0, Math.round(v.activeMin ?? 0))} min
            </T>
            <T size={16} line={24} color={quiet}>
              Active
            </T>
          </View>
        </View>
      </Pressable>

      {v.slots.walking}

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Press onPress={tapFor(v, 'food')} label={m.food.spoken} ripple={`${ink}14`} style={[card, styles.eHalf]}>
          <ELabel icon={L ? 'lock' : 'bowl'} text="Food" color={L ? ink : theme.food} />
          <T size={24} line={32} weight={700} color={ink} style={{ marginTop: 8 }}>
            {m.food.value}
          </T>
          {L ? null : (
            <>
              <T size={16} line={24} color={quiet}>
                of {v.food.target} kcal
              </T>
              <View style={[styles.track, { height: 8, borderRadius: 4, backgroundColor: theme.foodContainer, marginTop: 8 }]}>
                <View style={{ width: `${(m.food.share ?? 0) * 100}%`, height: 8, borderRadius: 4, backgroundColor: theme.food }} />
              </View>
            </>
          )}
        </Press>
        <Press onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} ripple={`${ink}14`} style={[card, styles.eHalf]}>
          <ELabel icon={L ? 'lock' : 'moon'} text="Sleep" color={L ? ink : theme.sleep} />
          <T size={24} line={32} weight={700} color={ink} style={{ marginTop: 8 }}>
            {m.sleep.unit ? `${m.sleep.value} ${m.sleep.unit}` : m.sleep.value}
          </T>
          {L ? null : (
            <T size={16} line={24} color={quiet}>
              Last night
            </T>
          )}
        </Press>
      </View>

      <Press onPress={tapFor(v, 'water')} label={m.water.spoken} ripple={`${ink}14`} style={[card, styles.eWater]}>
        <View style={{ flexShrink: 1 }}>
          <ELabel icon={L ? 'lock' : 'drop'} text="Water" color={L ? ink : theme.water} />
          <T size={24} line={32} weight={700} color={ink}>
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

      <Press onPress={tapFor(v, 'walk')} label={m.walk.spoken} ripple={`${ink}14`} style={[card, styles.eWalk]}>
        <View style={[styles.circle40, { backgroundColor: L ? theme.surfaceContainerHigh : theme.primaryContainer }]}>
          <SpecIcon name={L ? 'lock' : 'walker'} color={L ? ink : theme.onPrimaryContainer} size={20} />
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
  headButtons: { flexDirection: 'row', gap: 8 },
  fHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  fSquare: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fBlock: { marginHorizontal: 16, borderRadius: 16, padding: 20, gap: 16, overflow: 'hidden' },
  fHeroTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  fChip: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  baselineTight: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 4 },
  split: { flexDirection: 'row', gap: 3, height: 8 },
  segment: { flex: 1, borderRadius: 2, overflow: 'hidden' },
  fStats: { flexDirection: 'row' },
  fStat: { flex: 1, gap: 4 },
  fSection: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  spreadEnd: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  weekBars: { height: 40, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  weekCol: { flex: 1, height: 40, justifyContent: 'flex-end' },
  avgLine: { position: 'absolute', left: 0, right: 0, bottom: 32, borderTopWidth: 1, borderStyle: 'dashed' },
  weekLetters: { flexDirection: 'row', gap: 8 },
  center: { flex: 1, textAlign: 'center' },
  fInset: { marginHorizontal: 16 },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, paddingVertical: 8 },
  fIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fFoodBar: { width: 96, height: 6, borderRadius: 3, overflow: 'hidden' },
  fGlass: { height: 48, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logFood: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { overflow: 'hidden' },
  dTile: { borderRadius: 28 },
  dHalf: { flex: 1, padding: 16 },
  dChip: { height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center' },
  dGlass: { marginTop: 16, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  circle48: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  circle40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  eHalf: { flex: 1, padding: 16 },
  eWater: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  eGlass: { height: 56, minWidth: 56, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  eWalk: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
});
