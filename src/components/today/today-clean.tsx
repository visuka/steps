/**
 * The Clean+ Today (docs/design/clean-plus.png, spec 5.1 to 5.7, 7, 10), shared
 * by every look: greeting, week strip, the blue steps hero with its hour chart,
 * then the two-column tiles (Food, Water / Sleep, Walk). Numbers and wording
 * come from today-layout.ts and model.ts; this file only draws them.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  BarTrack,
  Greeting,
  heroColors,
  HourBars,
  IconCircle,
  Pill,
  SpecIcon,
  StatTile,
  WeekStrip,
} from '@/components/ui';
import { midTone } from '@/components/ui/hero-colors';
import { ICON_CIRCLE_STYLE, iconCircleRipple } from '@/components/ui/icon-circle-style';
import { pressedColorOnAccent } from '@/components/ui/surface-style';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { greetingWords } from './model';
import { tileValueStyle } from './value-style';
import {
  AXIS_LABELS,
  contentWidth,
  foodTile,
  heroChartWidth,
  heroNumbers,
  heroPill,
  heroRight,
  lockedTileModel,
  selectedDay,
  sleepTile,
  TILE_KINDS,
  tileWidth,
  TODAY_LAYOUT as L,
  type TileKind,
  type TileModel,
  walkTile,
  waterTile,
  weekShares,
} from './today-layout';
import type { TodayFrameLook, TodayView } from './view';

/** The plus circle's touch target: at least 48 dp, the circle centred in it, where the bare circle was. */
const PLUS_TOUCH = Math.max(ICON_CIRCLE_STYLE.minTouch, L.tile.plusSize);
const PLUS_PAD = (PLUS_TOUCH - L.tile.plusSize) / 2;

export function TodayClean({ v, look }: { v: TodayView; look: TodayFrameLook }) {
  const { width: screen } = useWindowDimensions();
  const content = contentWidth(screen, look.gutter, MaxContentWidth);
  const tile = tileWidth(content);
  const days = weekShares(v.week, v.goal);
  const food = foodTile(v.food);
  const water = waterTile(v.water);
  const sleep = sleepTile(v.sleep, v.sleepSpoken);
  const walk = walkTile(v.walk, v.walkSpoken);

  return (
    <View style={[styles.column, { paddingHorizontal: look.gutter, backgroundColor: look.background }]}>
      <Greeting
        date={v.dateLabel}
        name={v.name ?? ''}
        initial={v.initial}
        greeting={greetingWords(v.nowHour)}
        onAvatarPress={v.on.profile}
      />
      <WeekStrip
        days={days}
        selectedIndex={selectedDay(v.week)}
        onSelect={(i) => v.on.calendar(v.week[i]?.key)}
      />
      <StepsHero v={v} chartWidth={heroChartWidth(content)} />
      {v.slots.walking}
      {v.details ? (
        <>
          <View style={styles.grid}>
            <TileSlot width={tile}>
              <StatTileFor model={food} onPress={v.on.food} kind="food" />
            </TileSlot>
            <TileSlot width={tile}>
              <StatTileFor model={water} onPress={v.on.water} kind="water" onAddGlass={v.on.addGlass} />
            </TileSlot>
            <TileSlot width={tile}>
              <StatTileFor model={sleep} onPress={v.on.sleep} kind="sleep" />
            </TileSlot>
            <TileSlot width={tile}>
              <StatTileFor model={walk} onPress={v.on.walk} kind="walk" />
            </TileSlot>
          </View>
          {v.slots.note()}
          {v.slots.below}
        </>
      ) : (
        <>
          <View style={styles.grid}>
            {TILE_KINDS.map((kind) => (
              <TileSlot key={kind} width={tile}>
                <StatTileFor model={lockedTileModel(kind)} onPress={v.on.premium} kind={kind} />
              </TileSlot>
            ))}
          </View>
          {v.slots.locked}
        </>
      )}
    </View>
  );
}

/** Accent block: "Steps" and the day's distance, the big number, the share pill, the hour chart, its axis. */
function StepsHero({ v, chartWidth }: { v: TodayView; chartWidth: number }) {
  const theme = useTheme();
  const hero = heroColors(theme);
  const numbers = heroNumbers(v.steps, v.goal);
  const H = L.hero;
  return (
    <Pressable
      accessible={false}
      onPress={v.on.steps}
      android_ripple={{ color: pressedColorOnAccent(theme.onPrimary), foreground: true }}
      style={[styles.hero, { backgroundColor: theme.primary }]}>
      {/* One focus target for the figures; the chart below has its own spoken summary. */}
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={v.stepsSpoken}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={v.on.steps}>
        <View style={styles.heroHead}>
          <ThemedText type="bodySmall" maxFontSizeMultiplier={1.3} style={{ color: hero.label }}>
            Steps
          </ThemedText>
          <ThemedText
            type="bodySmall"
            maxFontSizeMultiplier={1.3}
            style={[styles.heroRight, { color: hero.label }]}>
            {heroRight(v.distance, v.activeMin, v.distanceUnit)}
          </ThemedText>
        </View>
        <View style={styles.heroNumberRow}>
          <View style={styles.heroNumber}>
            <ThemedText type="numeralHero" maxFontSizeMultiplier={1.3} style={{ color: hero.strong }}>
              {numbers.value}
            </ThemedText>
            <ThemedText type="bodyMedium" maxFontSizeMultiplier={1.3} style={{ color: hero.label }}>
              {numbers.of}
            </ThemedText>
          </View>
          <Pill label={heroPill(v.pct)} variant="hero" />
        </View>
      </View>
      <View style={{ marginTop: H.chartGap }}>
        <HourBars hours={v.hourly} goal={v.goal} now={v.nowHour} width={chartWidth} tone="hero" />
      </View>
      <View
        style={styles.axis}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {AXIS_LABELS.map((label, i) => (
          <ThemedText key={i} type="bodySmall" maxFontSizeMultiplier={1.3} style={[styles.axisLabel, { color: hero.label }]}>
            {label}
          </ThemedText>
        ))}
      </View>
    </Pressable>
  );
}

/** One grid cell: a fixed share of the width, tall as the taller tile of its row. */
function TileSlot({ width, children }: { width: number; children: ReactNode }) {
  return <View style={{ width }}>{children}</View>;
}

/**
 * A tile from its model. The Water tile's plus circle is its own focus target,
 * laid over the header's right end beside the tile (the tile is one button, so a
 * nested button would be unreachable for TalkBack).
 */
function StatTileFor({
  model,
  onPress,
  kind,
  onAddGlass,
}: {
  model: TileModel;
  onPress: () => void;
  kind: TileKind;
  onAddGlass?: () => void;
}) {
  const theme = useTheme();
  const T = L.tile;
  const circleTone = model.locked ? 'grey' : kind === 'food' ? 'warm' : kind === 'sleep' ? 'indigo' : 'accent';
  const icon = model.locked
    ? 'lock'
    : kind === 'food'
      ? 'bowl'
      : kind === 'water'
        ? 'drop'
        : kind === 'sleep'
          ? 'moon'
          : 'walker';
  const trailing =
    model.trailing === 'pill' && model.pill ? (
      <Pill label={model.pill} />
    ) : model.trailing === 'chevron' ? (
      <SpecIcon name="chevron-right" color={theme.onSurfaceVariant} />
    ) : null;
  const extra =
    model.pips && kind === 'water' ? (
      <Pips filled={model.pips.filled} total={model.pips.total} />
    ) : model.share !== undefined ? (
      <BarTrack share={model.share} color={kind === 'sleep' ? theme.sleep : theme.food} />
    ) : null;
  return (
    <View style={styles.tileWrap} accessible={false}>
      <StatTile
        label={model.label}
        value={model.value}
        unit={model.unit}
        note={model.note}
        iconCircle={<IconCircle name={icon} tone={circleTone} />}
        trailing={trailing}
        valueStyle={tileValueStyle(kind, model)}
        onPress={onPress}
        accessibilityLabel={model.spoken}
        style={styles.tile}>
        {extra}
      </StatTile>
      {model.trailing === 'plus' && onAddGlass ? (
        <Pressable
          onPress={onAddGlass}
          accessibilityRole="button"
          accessibilityLabel="Add a glass of water"
          android_ripple={{ color: iconCircleRipple(theme, 'accentSolid'), foreground: true, borderless: true, radius: PLUS_TOUCH / 2 }}
          style={[styles.plus, { top: T.plusInset - PLUS_PAD, right: T.plusInset - PLUS_PAD }]}>
          <IconCircle name="plus" tone="accentSolid" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Eight 4 dp pips: filled in the primary colour, the rest in the mid tone. */
function Pips({ filled, total }: { filled: number; total: number }) {
  const theme = useTheme();
  const mid = midTone(theme);
  return (
    <View style={styles.pips}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: i < filled ? theme.primary : mid }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: L.topPadding,
    gap: L.blockGap,
  },
  hero: {
    minHeight: L.hero.minHeight,
    padding: L.hero.padding,
    borderRadius: L.hero.radius,
    overflow: 'hidden',
  },
  heroHead: {
    minHeight: L.hero.headRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: L.hero.ofGap,
  },
  heroRight: { flexShrink: 1, textAlign: 'right' },
  heroNumberRow: {
    marginTop: L.hero.numberGap,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: L.hero.ofGap,
  },
  heroNumber: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: L.hero.ofGap },
  axis: { marginTop: L.hero.axisGap, flexDirection: 'row' },
  axisLabel: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: L.tileGap, rowGap: L.tileGap },
  tileWrap: { flexGrow: 1 },
  tile: { flexGrow: 1, flexBasis: 'auto' },
  // The wrapper itself is the 48 dp touch target; the 40 dp circle sits centred in it.
  plus: {
    position: 'absolute',
    width: PLUS_TOUCH,
    height: PLUS_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pips: { flexDirection: 'row', columnGap: L.tile.pipGap },
  pip: { flex: 1, height: L.tile.pipHeight, borderRadius: L.tile.pipRadius },
});
