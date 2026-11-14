/**
 * The walk screen as the Clean+ mockup draws it (docs/design/spec.md 5.9,
 * 5.11, 6): top bar with the Walk / Run / Cycle control, title, date and time,
 * weather, the map card, distance with the pace sparkline, four stat cards,
 * the parts list. One layout for every look: a look changes colours and
 * fonts (roles) and its map colours (ThemeDef.map), never the layout.
 *
 * Data and taps come in as props; the route screen loads the walk.
 */

import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { type ReactNode, use, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { mapSchemeFor } from '@/components/map-style';
import { RouteMap } from '@/components/route-map';
import { ThemedText } from '@/components/themed-text';
import { Button, Pill, Sheet, SpecIcon, type SpecIconName, Why } from '@/components/ui';
import { ICON_CIRCLE_STYLE, iconCircleColors, type IconCircleTone } from '@/components/ui/icon-circle-style';
import { backHitSlop, bottomPadding, topPadding } from '@/components/ui/screen-style';
import { valueWithUnit } from '@/components/ui/stat-tile-style';
import { pressedColor } from '@/components/ui/surface-style';
import { ActiveTheme, MaxContentWidth } from '@/constants/theme';
import { mapColorsOf } from '@/constants/themes/build';
import type { PartChoice, Walk, WalkPart, WeatherCondition } from '@/data/types';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, formatDayLong } from '@/lib/dates';
import type { Units } from '@/lib/format';
import type { WalkPoint } from '@/lib/walk';
import { formatClock } from '@/lib/when';
import { partAnswers, walkTitle } from '@/walks/labels';
import { answerLabel, DISTANCE_WHY, distanceSourceText, partFacts, partStatus, PARTS_WHY, routeLines } from '@/walks/view';

import { CYCLE, Glyph, WEATHER_GLYPH } from './walk-icons';
import {
  activityName,
  NO_WEATHER,
  type PartRow,
  partsModel,
  SEGMENTS,
  SPARK,
  type Stat,
  sparkline,
  speedSeries,
  walkStats,
  weatherText,
} from './walk-model';
import { chunk, segmentWidth, STAT_ICON, WALK_STYLE } from './walk-style';

/** Spec 10.4: every text grows with the phone's setting up to 1.3. */
const SCALE = { maxFontSizeMultiplier: 1.3 } as const;

export interface WalkDetailLookProps {
  walk: Walk;
  points: WalkPoint[];
  parts: WalkPart[];
  units: Units;
  /** A part's answer is being saved: the row buttons wait. */
  busy: boolean;
  onAnswer: (ord: number, choice: PartChoice | null) => void;
  onDelete: () => void;
  onBack: () => void;
}

export function WalkDetailLook(props: WalkDetailLookProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inTabs = use(BottomTabBarHeightContext) !== undefined;
  const clock = useClockStyle();
  const [sheetOrd, setSheetOrd] = useState<number | null>(null);
  const { walk, points, parts, units } = props;

  const activity = walk.activity ?? 'walk';
  const ride = activity === 'ride';
  const lines = useMemo(() => routeLines(points, parts, walk.stretches), [points, parts, walk.stretches]);
  const spark = useMemo(() => sparkline(speedSeries(points)), [points]);
  const stats = walkStats(walk, units);
  const model = partsModel(walk, parts);
  const weather = weatherText(walk.weather, units);
  const sourceText = walk.distanceFrom && walk.distanceFrom !== 'route' ? distanceSourceText(walk.distanceFrom) : null;
  const sheetPart = parts.find((p) => p.ord === sheetOrd) ?? null;
  const hero = stats.hero;

  return (
    <View style={[styles.fill, { backgroundColor: theme.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPadding(insets.top, true), paddingBottom: bottomPadding(inTabs, insets.bottom, false) },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.topBar}>
            <Pressable
              onPress={props.onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={backHitSlop()}
              style={styles.back}>
              <SpecIcon name="chevron-left" color={theme.onSurface} size={WALK_STYLE.backIconSize} />
            </Pressable>
            <ActivitySegments activity={activity} />
          </View>

          <ThemedText type="headlineSmall" accessibilityRole="header" {...SCALE} style={styles.title}>
            {walkTitle(walk.startedAt, activity)}
          </ThemedText>

          <View style={styles.info}>
            <View style={styles.infoGroup}>
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
                {formatDayLong(dayKey(new Date(walk.startedAt)))}
              </ThemedText>
              <Pill label={formatClock(walk.startedAt, clock)} />
            </View>
            <View style={styles.infoGroup}>
              {walk.weather ? <WeatherIcon condition={walk.weather.condition} color={theme.onSurfaceVariant} /> : null}
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
                {weather ?? NO_WEATHER}
              </ThemedText>
            </View>
          </View>

          <MapCard walk={walk} lines={lines} label={`Route map, ${hero.value}${hero.unit ? ` ${hero.unit}` : ''}`} />

          <View style={styles.distance}>
            <View style={styles.heroFigure}>
              <ThemedText type="numeralHero" {...SCALE}>
                {hero.value}
              </ThemedText>
              {hero.unit ? (
                <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" {...SCALE}>
                  {hero.unit}
                </ThemedText>
              ) : null}
            </View>
            {spark ? (
              <View style={styles.sparkBlock}>
                <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
                  {ride ? 'Speed over time' : 'Pace over time'}
                </ThemedText>
                <Sparkline line={spark.line} area={spark.area} />
              </View>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            {chunk(stats.stats, WALK_STYLE.stat.columns).map((row, i) => (
              <View key={i} style={styles.statRow}>
                {row.map((s) => (
                  <StatCard key={s.id} stat={s} />
                ))}
                {row.length < WALK_STYLE.stat.columns ? <View style={styles.fill} /> : null}
              </View>
            ))}
          </View>

          <ThemedText type="labelLarge" accessibilityRole="header" {...SCALE} style={styles.partsHeading}>
            Parts
          </ThemedText>
          <View style={styles.partsGroup}>
            <Row last={model.parts.length === 0} circle={<Circle tone="accent" name={ride ? 'cycle' : 'walker'} />}>
              <ThemedText type="bodyMedium" {...SCALE} style={styles.fill}>
                {model.main.name}
              </ThemedText>
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" {...SCALE}>
                {model.main.time}
              </ThemedText>
            </Row>
            {model.parts.map((p, i) => (
              <PartListRow
                key={p.ord}
                part={p}
                last={i === model.parts.length - 1}
                busy={props.busy}
                onOpen={() => setSheetOrd(p.ord)}
                onToggle={() => props.onAnswer(p.ord, p.toggle.choice)}
              />
            ))}
          </View>

          {sourceText ? (
            <View style={styles.sourceLine}>
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE} style={styles.fill}>
                {sourceText}
              </ThemedText>
              <Why title="Distance" text={DISTANCE_WHY} />
            </View>
          ) : null}
          <View style={styles.deleteRow}>
            <Button label={`Delete ${ride ? 'ride' : 'walk'}`} variant="text" danger onPress={props.onDelete} />
          </View>
        </View>
      </ScrollView>
      {/* The status bar's strip in the page colour: the content scrolls under it, never under the clock. */}
      <View pointerEvents="none" style={[styles.statusInset, { height: insets.top, backgroundColor: theme.surface }]} />
      <PartSheet
        part={sheetPart}
        walk={walk}
        units={units}
        busy={props.busy}
        onClose={() => setSheetOrd(null)}
        onAnswer={(ord, choice) => {
          setSheetOrd(null);
          props.onAnswer(ord, choice);
        }}
      />
    </View>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────

/**
 * Walk / Run / Cycle (spec 5.9): 216 x 40, soft well, the selected segment
 * white. It shows what was recorded; a saved walk or ride can't change kind,
 * so the segments read as one label for TalkBack.
 */
function ActivitySegments({ activity }: { activity: Walk['activity'] }) {
  const theme = useTheme();
  const seg = WALK_STYLE.segmented;
  const selected = activityName(activity ?? 'walk');
  return (
    <View
      accessible
      accessibilityLabel={`Recorded as ${activity === 'ride' ? 'a cycle ride' : 'a walk'}`}
      style={[
        styles.segments,
        { width: seg.width, minHeight: seg.height, padding: seg.padding, borderRadius: seg.radius, backgroundColor: theme.surfaceContainer },
      ]}>
      {SEGMENTS.map((label) => {
        const on = label === selected;
        return (
          <View
            key={label}
            style={[
              styles.segment,
              { width: segmentWidth(), borderRadius: seg.selectedRadius },
              on && { backgroundColor: theme.surfaceContainerLowest, boxShadow: seg.boxShadow },
            ]}>
            <ThemedText
              type="bodySmall"
              themeColor={on ? 'onSurface' : 'onSurfaceVariant'}
              numberOfLines={1}
              {...SCALE}
              style={on ? styles.medium : null}>
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** The sun is the spec's own icon; the other conditions reuse its stroke. */
function WeatherIcon({ condition, color }: { condition: WeatherCondition; color: string }) {
  if (condition === 'clear') return <SpecIcon name="sun" color={color} />;
  return <Glyph parts={WEATHER_GLYPH[condition]} size={WALK_STYLE.backIconSize} color={color} stroke={1.5} />;
}

/** The map card (spec 5.11): white, 24 round, card shadow, 160 high; or its frame saying why there is no route. */
function MapCard({ walk, lines, label }: { walk: Walk; lines: ReturnType<typeof routeLines>; label: string }) {
  const theme = useTheme();
  const m = WALK_STYLE.map;
  const colors = mapColorsOf(ActiveTheme, mapSchemeFor(undefined));
  const ride = walk.activity === 'ride';
  const empty = ride && walk.distanceFrom === 'none' ? 'Indoor bike · no route' : walk.indoor ? 'Indoor · no route' : 'No route: GPS had no fix';
  return (
    <View style={{ marginTop: WALK_STYLE.blockGap, borderRadius: m.radius, backgroundColor: theme.surfaceContainerLowest, boxShadow: m.boxShadow }}>
      {lines.length ? (
        <RouteMap lines={lines} height={m.height} radius={m.radius} dots={WALK_STYLE.dots} label={label} />
      ) : (
        <View style={[styles.noRoute, { minHeight: m.height, borderRadius: m.radius, backgroundColor: colors.land }]}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" {...SCALE} style={styles.center}>
            {empty}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

/** Pace over time (spec 6.1): the area in accentTint, the line in accent, 2 wide. */
function Sparkline({ line, area }: { line: string; area: string }) {
  const theme = useTheme();
  return (
    <View style={styles.spark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={SPARK.width} height={SPARK.height} viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}>
        <Path d={area} fill={theme.primaryContainer} />
        <Path
          d={line}
          fill="none"
          stroke={theme.primary}
          strokeWidth={WALK_STYLE.sparkline.lineWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** A stat card (spec 5.11): white, 24 round, shadow, 72 high; tinted circle, value with its unit, label. */
function StatCard({ stat }: { stat: Stat }) {
  const theme = useTheme();
  const s = WALK_STYLE.stat;
  const parts = valueWithUnit(stat.value, stat.unit);
  return (
    <View
      accessible
      accessibilityLabel={`${stat.label}: ${stat.value}${stat.unit ? ` ${stat.unit}` : ''}`}
      style={[
        styles.stat,
        {
          minHeight: s.height,
          paddingHorizontal: s.paddingX,
          gap: s.gap,
          borderRadius: s.radius,
          backgroundColor: theme.surfaceContainerLowest,
          boxShadow: s.boxShadow,
        },
      ]}>
      <Circle tone="accent" name={STAT_ICON[stat.id]} />
      <View style={styles.statText}>
        <ThemedText type="titleMedium" {...SCALE}>
          {parts.value}
          {parts.unit ? (
            <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
              {parts.unit}
            </ThemedText>
          ) : null}
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
          {stat.label}
        </ThemedText>
      </View>
    </View>
  );
}

/** The 40 dp circle of a row (spec 4): a spec icon, or the bicycle. */
function Circle({ tone, name }: { tone: IconCircleTone; name: SpecIconName | 'cycle' }) {
  const theme = useTheme();
  const { fill, icon } = iconCircleColors(theme, tone);
  const size = ICON_CIRCLE_STYLE.size;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}>
      {name === 'cycle' ? (
        <Glyph parts={CYCLE} size={ICON_CIRCLE_STYLE.iconSize} color={icon} stroke={1.5} />
      ) : (
        <SpecIcon name={name} color={icon} />
      )}
    </View>
  );
}

/** A parts row (spec 5.11): 56 high, gap 12, the hairline under the text part only, none on the last row. */
function Row({ circle, last, children }: { circle: ReactNode; last: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.partRow}>
      {circle}
      <View style={[styles.partText, !last && { borderBottomWidth: WALK_STYLE.part.hairline, borderBottomColor: theme.outlineVariant }]}>
        {children}
      </View>
    </View>
  );
}

/**
 * A part of the walk: a car (or cycling) stretch. Left out, it is the mockup's
 * removed row (grey circle, muted name over "6 min · removed", "Keep" at the
 * right). Counted, the same row with the accent circle, the ink name and
 * "Remove". The name and status open every choice; the word answers in one tap.
 * Siblings, so TalkBack reaches both.
 */
function PartListRow({
  part,
  last,
  busy,
  onOpen,
  onToggle,
}: {
  part: PartRow;
  last: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const cycle = part.name === 'Cycle';
  return (
    <Row last={last} circle={<Circle tone={part.counted ? 'accent' : 'grey'} name={cycle ? 'cycle' : 'car'} />}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${part.name} ${part.time}, ${part.status}`}
        accessibilityHint="Shows every choice for this part"
        android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
        style={styles.partInfo}>
        <ThemedText type="bodyMedium" themeColor={part.counted ? 'onSurface' : 'onSurfaceVariant'} {...SCALE}>
          {part.name}
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
          {`${part.time} · ${part.status}`}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={onToggle}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${part.toggle.label}: ${part.name} ${part.time}`}
        accessibilityState={{ disabled: busy }}
        android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
        style={[styles.keep, busy && styles.disabled]}>
        <ThemedText type="labelLarge" themeColor="primary" {...SCALE}>
          {part.toggle.label}
        </ThemedText>
      </Pressable>
    </Row>
  );
}

/** Every choice for a part, in a sheet. */
function PartSheet({
  part,
  walk,
  units,
  busy,
  onClose,
  onAnswer,
}: {
  part: WalkPart | null;
  walk: Walk;
  units: Units;
  busy: boolean;
  onClose: () => void;
  onAnswer: (ord: number, choice: PartChoice | null) => void;
}) {
  const activity = walk.activity ?? 'walk';
  const row = part ? partsModel(walk, [part]).parts[0] : null;
  return (
    <Sheet visible={!!part} onClose={onClose} title={row ? `${row.name} ${row.time}` : undefined}>
      {part ? (
        <View style={styles.sheet}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" {...SCALE}>
            {partFacts(part, units)}
          </ThemedText>
          <ThemedText type="labelLarge" {...SCALE}>
            {partStatus(part, activity)}
          </ThemedText>
          <View style={styles.answers}>
            {partAnswers(part, activity).map((choice, i) => (
              <Button
                key={choice}
                label={answerLabel(choice, activity)}
                variant={i === 0 ? 'tonal' : 'outlined'}
                compact
                disabled={busy || part.choice === choice}
                onPress={() => onAnswer(part.ord, choice)}
              />
            ))}
            {part.choice !== null ? (
              <Button label="Undo" variant="text" compact disabled={busy} onPress={() => onAnswer(part.ord, null)} />
            ) : null}
          </View>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" {...SCALE}>
            {PARTS_WHY}
          </ThemedText>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  medium: { fontWeight: '500' },
  statusInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: WALK_STYLE.sideMargin, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth },
  // Heights from the spec are minimums: a row grows with large text.
  topBar: { minHeight: WALK_STYLE.topBarHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { height: WALK_STYLE.topBarHeight, marginLeft: WALK_STYLE.backMarginLeft, justifyContent: 'center' },
  segments: { flexDirection: 'row' },
  segment: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: WALK_STYLE.titleGap },
  info: {
    minHeight: WALK_STYLE.infoHeight,
    marginTop: WALK_STYLE.infoGap,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: WALK_STYLE.infoItemGap,
  },
  infoGroup: { flexDirection: 'row', alignItems: 'center', gap: WALK_STYLE.infoItemGap },
  noRoute: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: WALK_STYLE.sideMargin, overflow: 'hidden' },
  distance: {
    marginTop: WALK_STYLE.blockGap,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: WALK_STYLE.blockGap,
  },
  heroFigure: { flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: WALK_STYLE.distanceGap },
  sparkBlock: { width: WALK_STYLE.sparkline.width },
  spark: { marginTop: WALK_STYLE.sparkline.labelGap },
  statGrid: { marginTop: WALK_STYLE.blockGap, gap: WALK_STYLE.blockGap },
  statRow: { flexDirection: 'row', gap: WALK_STYLE.blockGap },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statText: { flex: 1 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  partsHeading: { marginTop: WALK_STYLE.partsGap },
  partsGroup: { marginTop: WALK_STYLE.partsGroupGap },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: WALK_STYLE.part.gap, minHeight: WALK_STYLE.part.height },
  partText: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', minHeight: WALK_STYLE.part.height },
  partInfo: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  keep: { minHeight: WALK_STYLE.keepMinHeight, paddingLeft: WALK_STYLE.part.gap, justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  sourceLine: { flexDirection: 'row', alignItems: 'center', gap: WALK_STYLE.infoItemGap, minHeight: 32, marginTop: WALK_STYLE.infoItemGap },
  deleteRow: { alignItems: 'flex-start', marginTop: WALK_STYLE.infoItemGap },
  sheet: { gap: WALK_STYLE.part.gap },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: WALK_STYLE.infoItemGap },
});
