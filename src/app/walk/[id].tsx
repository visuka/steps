import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { confirm } from '@/components/confirm';
import { PremiumGate } from '@/components/premium-gate';
import { RouteMap } from '@/components/route-map';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, type IconName, Screen, SectionHeader, StatTile, Surface, Why } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { PartChoice, Walk, WalkPart } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration, formatPace, formatSteps, formatTemp } from '@/lib/format';
import { paceSecPerKm, type WalkPoint } from '@/lib/walk';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { partAnswers, walkTitle } from '@/walks/labels';
import { choosePart, refreshWalkSteps } from '@/walks/save';
import {
  answerLabel,
  averageSpeedMs,
  climbText,
  DISTANCE_WHY,
  distanceSourceText,
  formatSpeed,
  historyLine,
  isDashed,
  LEGEND_TEXT,
  legendKinds,
  lineColor,
  type LineKind,
  partFacts,
  partStatus,
  PARTS_WHY,
  partTitle,
  routeLines,
  splitUnit,
  stairsView,
  WEATHER_ICON,
} from '@/walks/view';
import { CONDITION_LABEL } from '@/weather/met';

const EFFORT_TEXT = { easy: 'Easy', steady: 'Steady', hard: 'Hard' } as const;

export default function WalkDetailRoute() {
  const router = useRouter();
  return (
    <PremiumGate feature={SCREEN_FEATURES['walk/[id]']} title="Walk" onBack={() => router.back()}>
      <WalkDetailScreen />
    </PremiumGate>
  );
}

function WalkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, source, profile, touch } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [walk, setWalk] = useState<Walk | null>(null);
  const [points, setPoints] = useState<WalkPoint[]>([]);
  const [parts, setParts] = useState<WalkPart[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [found, foundParts] = await Promise.all([repo.getWalk(id), repo.getWalkParts(id)]);
      if (!live) return;
      if (!found) {
        setMissing(true);
        return;
      }
      setWalk(found.walk);
      setPoints(found.points);
      setParts(foundParts);
      const updated = await refreshWalkSteps(repo, source, profile, found.walk, found.points);
      if (live && updated !== found.walk) setWalk(updated);
    })();
    return () => {
      live = false;
    };
  }, [repo, source, profile, id]);

  const answer = async (ord: number, choice: PartChoice | null) => {
    if (!walk) return;
    setBusy(ord);
    try {
      const updated = await choosePart(repo, walk.id, ord, choice);
      const fresh = await repo.getWalkParts(walk.id);
      if (updated) setWalk(updated);
      setParts(fresh);
      touch();
    } finally {
      setBusy(null);
    }
  };

  const what = walk?.activity === 'ride' ? 'ride' : 'walk';
  const remove = () =>
    confirm(`Delete this ${what}?`, 'Its route and stats will be removed. Your step counts stay.', async () => {
      await repo.deleteWalk(id);
      touch();
      router.back();
    });

  if (!walk) {
    return (
      <Screen title="Walk" onBack={() => router.back()}>
        {missing ? <EmptyState icon="trash-outline" title="This was deleted" /> : null}
      </Screen>
    );
  }

  const activity = walk.activity ?? 'walk';
  const ride = activity === 'ride';
  const indoorRide = ride && walk.distanceFrom === 'none';
  const durationS = walk.movingS || (walk.endedAt - walk.startedAt) / 1000;
  const lines = routeLines(points, parts, walk.stretches);
  const legend = legendKinds(lines);
  const sourceText = distanceSourceText(walk.distanceFrom);
  const stairs = stairsView(walk);
  const climb = climbText(walk.climbM);

  const tile = (label: string, text: string, icon: IconName, note?: string) => {
    const [value, unit] = splitUnit(text);
    return <StatTile key={label} label={label} value={value} unit={unit} icon={icon} note={note} tone="steps" />;
  };
  const distance = tile('Distance', formatDistance(walk.distanceM, profile.units), 'navigate-outline');
  const kcal = tile('Active kcal', formatSteps(walk.activeKcal), 'flame-outline', 'Estimated');
  const tiles = indoorRide
    ? [
        tile('Time', formatDuration(durationS), 'timer-outline'),
        kcal,
        ...(walk.effort ? [tile('Effort', EFFORT_TEXT[walk.effort], 'pulse-outline')] : []),
      ]
    : ride
      ? [
          distance,
          tile('Moving time', formatDuration(durationS), 'timer-outline'),
          tile('Avg speed', formatSpeed(averageSpeedMs(walk.distanceM, walk.movingS), profile.units), 'analytics-outline'),
          tile('Top speed', formatSpeed(walk.topSpeedMs, profile.units), 'speedometer-outline'),
          ...(climb ? [tile('Climb', climb, 'trending-up')] : []),
          kcal,
        ]
      : [
          distance,
          tile('Moving time', formatDuration(durationS), 'timer-outline'),
          tile('Pace', formatPace(paceSecPerKm(walk.distanceM, walk.movingS), profile.units), 'speedometer-outline'),
          tile('Steps', walk.steps === null ? '—' : formatSteps(walk.steps), 'footsteps-outline'),
          kcal,
        ];

  return (
    <Screen title={walkTitle(walk.startedAt, activity)} subtitle={historyLine(walk)} onBack={() => router.back()}>
      {lines.length ? (
        <View style={styles.group}>
          <RouteMap lines={lines} height={280} />
          {legend.length > 1 || legend[0] !== 'route' ? (
            <View style={styles.legend}>
              {legend.map((k) => (
                <LegendItem key={k} kind={k} />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Surface level={2} style={styles.noRoute}>
          <Ionicons name={indoorRide ? 'bicycle' : walk.indoor ? 'home-outline' : 'map-outline'} size={24} color={theme.onSurfaceVariant} />
          <ThemedText type="bodyLarge" themeColor="onSurfaceVariant" style={styles.flex}>
            {indoorRide ? 'Indoor bike · no route' : walk.indoor ? 'Indoor · no route' : 'No route: GPS had no fix'}
          </ThemedText>
        </Surface>
      )}

      {sourceText ? (
        <View style={styles.line}>
          <Ionicons
            name={walk.distanceFrom === 'route' ? 'navigate-outline' : 'footsteps-outline'}
            size={18}
            color={theme.onSurfaceVariant}
          />
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.flex}>
            {sourceText}
          </ThemedText>
          <Why title="Distance" text={DISTANCE_WHY} />
        </View>
      ) : null}

      <View style={styles.tiles}>{tiles}</View>

      {parts.length ? (
        <>
          <SectionHeader title={parts.length === 1 ? 'Check this part' : 'Check these parts'} why={PARTS_WHY} />
          {parts.map((p) => (
            <Surface key={p.ord} level={2} style={styles.panel}>
              <View style={styles.line}>
                <Swatch kind={p.choice === 'remove' || (p.choice === null && !p.defaultKeep) ? 'left-out' : 'part'} />
                <ThemedText type="titleMedium" style={styles.flex}>
                  {partTitle(p, activity)}
                </ThemedText>
              </View>
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
                {partFacts(p, profile.units)}
              </ThemedText>
              <ThemedText type="labelLarge">{partStatus(p, activity)}</ThemedText>
              {p.choice === null ? (
                <View style={styles.answers}>
                  {partAnswers(p, activity).map((choice, i) => (
                    <Button
                      key={choice}
                      label={answerLabel(choice, activity)}
                      variant={i === 0 ? 'tonal' : 'outlined'}
                      compact
                      disabled={busy !== null}
                      onPress={() => answer(p.ord, choice)}
                    />
                  ))}
                </View>
              ) : (
                <Button label="Undo" variant="text" compact disabled={busy !== null} onPress={() => answer(p.ord, null)} />
              )}
            </Surface>
          ))}
        </>
      ) : null}

      {stairs || (!ride && climb) ? (
        <Surface level={2} style={styles.panel}>
          {stairs ? (
            <>
              <Floors icon="arrow-up" label="Stairs up" value={stairs.up} />
              <Floors icon="arrow-down" label="Stairs down" value={stairs.down} />
              {stairs.liftUp ? <Floors icon="arrow-up-circle-outline" label="Lift up" value={stairs.liftUp} /> : null}
              {stairs.liftDown ? <Floors icon="arrow-down-circle-outline" label="Lift down" value={stairs.liftDown} /> : null}
            </>
          ) : null}
          {!ride && climb ? (
            <View style={styles.line}>
              <Ionicons name="trending-up" size={20} color={theme.onSurfaceVariant} />
              <ThemedText type="bodyLarge" style={styles.flex}>
                Uphill
              </ThemedText>
              <ThemedText type="numeralSmall">{climb}</ThemedText>
            </View>
          ) : null}
        </Surface>
      ) : null}

      {walk.weather ? (
        <View style={styles.line}>
          <Ionicons name={WEATHER_ICON[walk.weather.condition]} size={20} color={theme.onSurfaceVariant} />
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.flex}>
            {/* Always the forecast for the walk's hours, never an observation. */}
            Forecast · {CONDITION_LABEL[walk.weather.condition]} · {formatTemp(walk.weather.tempC, profile.units)}
          </ThemedText>
        </View>
      ) : null}

      <Button label={`Delete ${what}`} variant="text" danger onPress={remove} />
    </Screen>
  );
}

function Swatch({ kind }: { kind: LineKind }) {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={24} height={8}>
        <Line
        x1={2}
        y1={4}
        x2={22}
        y2={4}
        stroke={lineColor(theme, kind)}
        strokeWidth={4}
        strokeDasharray={isDashed(kind) ? '4 3' : undefined}
        strokeLinecap={isDashed(kind) ? 'butt' : 'round'}
        />
      </Svg>
    </View>
  );
}

function LegendItem({ kind }: { kind: LineKind }) {
  return (
    <View style={styles.legendItem}>
      <Swatch kind={kind} />
      <ThemedText type="labelMedium" themeColor="onSurfaceVariant">
        {LEGEND_TEXT[kind]}
      </ThemedText>
    </View>
  );
}

function Floors({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value} ${value === 1 ? 'floor' : 'floors'}`}>
      <Ionicons name={icon} size={20} color={theme.onSurfaceVariant} />
      <ThemedText type="bodyLarge" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type="numeralSmall">{value}</ThemedText>
      <ThemedText type="labelMedium" themeColor="onSurfaceVariant">
        {value === 1 ? 'floor' : 'floors'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: Spacing.two },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 24 },
  noRoute: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, minHeight: 72 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  panel: { padding: Spacing.three, gap: Spacing.two },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
