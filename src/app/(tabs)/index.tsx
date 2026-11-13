import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BarChart } from '@/components/bar-chart';
import { hourName } from '@/components/bar-chart-speech';
import { MoodPicker } from '@/components/mood-picker';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  ExtendedFab,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Snackbar,
  StatTile,
  Surface,
  TickBar,
  TrackProgress,
  Why,
} from '@/components/ui';
import { standardTiming } from '@/components/ui/motion';
import { WaterBody } from '@/components/food/water-card';
import { Motion, NumeralMaxScale, Spacing } from '@/constants/theme';
import type { DayWeather, LogEntry } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { formatDistance, formatSteps, formatTemp, minutesAgo } from '@/lib/format';
import { SUGGESTION_DAYS, suggestGoal } from '@/lib/goals';
import { locationAllowed, requestLocation } from '@/location/place';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';
import { useMoodToday } from '@/state/use-mood';
import { usePremium } from '@/state/use-premium';
import { type AddedGlass, useWaterToday, type WaterHook } from '@/state/use-water';
import { walkRecorder } from '@/walks/recorder';
import { dayKcalTarget } from '@/nutrition/targets';
import { kcalBalanceText } from '@/nutrition/view';
import { CONDITION_LABEL } from '@/weather/met';

const WEATHER_PROMPT_KEY = 'weatherPromptDismissed';
const HOUR_LABELS: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };

type Tile = 'food' | 'water' | 'active';

export default function TodayScreen() {
  const { source, profile, displaySteps, lastSyncAt, syncing, refresh, updateProfile } = useApp();
  const router = useRouter();
  const premium = usePremium();
  const { width, height } = useWindowDimensions();
  // Free: today's steps and the goal on the track; everything else on Today is premium.
  const details = !premium.isLocked('today-details');
  const todayKey = dayKey(new Date());
  const [walking, setWalking] = useState(false);
  const [focus, setFocus] = useState<Tile | null>(null);
  const [snack, setSnack] = useState<{ text: string; undo?: LogEntry } | null>(null);
  // The same water as the Food tab's card: one glass is the person's glass size (water/add.ts).
  const water = useWaterToday(details && !premium.isLocked('body'));

  useFocusEffect(
    useCallback(() => {
      walkRecorder.active().then((id) => setWalking(id !== null));
    }, []),
  );

  // An open tile closes on Back before Back leaves the screen.
  const onScreen = useIsFocused();
  const tileOpen = focus !== null;
  useEffect(() => {
    if (!tileOpen || !onScreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFocus(null);
      return true;
    });
    return () => sub.remove();
  }, [tileOpen, onScreen]);

  const showAdded = (a: AddedGlass | null) =>
    setSnack(a ? { text: a.text, undo: a.entry } : { text: "Couldn't save that. Try again." });
  const addGlass = async () => showAdded(await water.add());

  const logFood = () => router.navigate({ pathname: '/food', params: { add: String(Date.now()) } });
  const goal = profile.dailyGoal;
  const syncLine = `${lastSyncAt ? `Updated ${minutesAgo(lastSyncAt)}` : 'Not synced yet'} · ${source.label}`;
  const trackHeight = Math.round(Math.min((Math.min(width, 640) - Spacing.three * 2) / 1.4, height * 0.36));
  // While a tile's detail is open the hero steps back to about a quarter of the
  // screen, so the detail opens in the first viewport instead of under the fold.
  const openHeight = Math.round(height * 0.25);

  return (
    <Screen
      title={formatDayLong(todayKey)}
      titleSize="small"
      subtitle={syncLine}
      refreshing={syncing}
      onRefresh={refresh}
      fab={
        details && !premium.isLocked('food') && focus === null ? (
          <ExtendedFab label="Log food" icon="add" onPress={logFood} accessibilityHint="Opens Food, ready to type" />
        ) : undefined
      }
      overlay={
        <Snackbar
          message={snack?.text ?? null}
          action={snack?.undo ? { label: 'Undo', onPress: () => water.undo(snack.undo!) } : undefined}
          onDismiss={() => setSnack(null)}
        />
      }>
      {/* A walk started with premium can always be got back to and finished. */}
      {walking ? (
        <Surface level={3}>
          <ListRow
            icon="walk"
            title="Walk in progress"
            supporting="Tap to see it or finish"
            chevron
            onPress={() => router.push('/walk/record')}
          />
        </Surface>
      ) : null}

      <Recede dimmed={focus !== null}>
        <StepsTrack
          steps={displaySteps}
          goal={goal}
          height={tileOpen ? Math.min(trackHeight, openHeight) : trackHeight}
          minHeight={tileOpen ? openHeight : Math.round(height * 0.4)}
        />
      </Recede>

      <PremiumGate feature="today-details">
        <TodayTiles
          focus={focus}
          onFocus={setFocus}
          water={water}
          onAddGlass={addGlass}
          onAdded={showAdded}
          onOpenFood={() => router.navigate('/food')}
        />
        <Recede dimmed={focus !== null}>
          <BelowTheFold
            weatherDay={todayKey}
            onGoal={(dailyGoal) => updateProfile({ dailyGoal })}
            onLocation={refresh}
          />
        </Recede>
      </PremiumGate>
    </Screen>
  );
}

/** Fades the rest back while a tile's detail is open. */
function Recede({ dimmed, children }: { dimmed: boolean; children: ReactNode }) {
  const fade = useSharedValue(dimmed ? 0.4 : 1);
  useEffect(() => {
    fade.value = withTiming(dimmed ? 0.4 : 1, standardTiming(Motion.duration.short));
  }, [dimmed, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View style={[styles.recede, style]} pointerEvents={dimmed ? 'none' : 'auto'}>
      {children}
    </Animated.View>
  );
}

/** The hero: today's steps on the track, the goal and laps under the number. */
function StepsTrack({ steps, goal, height, minHeight }: { steps: number; goal: number; height: number; minHeight: number }) {
  const theme = useTheme();
  const left = Math.max(0, goal - steps);
  const lap = goal > 0 ? Math.floor(steps / goal) + 1 : 1;
  return (
    <View style={[styles.hero, { minHeight: Math.max(minHeight, height + Spacing.five) }]}>
      <TrackProgress
        value={steps}
        goal={goal}
        aspect={1.4}
        maxHeight={height}
        accessibilityLabel={`${formatSteps(steps)} of ${formatSteps(goal)} steps${left === 0 ? ', goal reached' : `, ${formatSteps(left)} to go`}`}>
        <ThemedText
          type="numeralHero"
          maxFontSizeMultiplier={NumeralMaxScale}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.center}>
          {formatSteps(steps)}
        </ThemedText>
        <ThemedText type="labelLarge" themeColor="onSurfaceVariant" style={styles.center}>
          of {formatSteps(goal)} steps
        </ThemedText>
        <View style={styles.lapRow}>
          {left === 0 ? <Ionicons name="checkmark-circle" size={16} color={theme.onSurface} /> : null}
          <ThemedText type="labelMedium" style={styles.center}>
            {left === 0 ? `Goal done · lap ${lap}` : `${formatSteps(left)} to go`}
          </ThemedText>
        </View>
      </TrackProgress>
    </View>
  );
}

/** One row of three tiles; tapping one opens its detail in place. */
function TodayTiles({
  focus,
  onFocus,
  water,
  onAddGlass,
  onAdded,
  onOpenFood,
}: {
  focus: Tile | null;
  onFocus: (t: Tile | null) => void;
  water: WaterHook;
  onAddGlass: () => void;
  onAdded: (a: AddedGlass | null) => void;
  onOpenFood: () => void;
}) {
  const { profile, today } = useApp();
  const { fontScale } = useWindowDimensions();
  const calories = useCaloriesToday();
  // The day's energy, as on the Food tab's track: resting plus walking, or a fifth more. Past it stays brick, never red.
  const dayBurn = dayKcalTarget(profile, calories.active, new Date().getFullYear());
  const ws = water.status;
  const glasses = ws?.progress?.glasses ?? Math.floor(((ws?.waterMl ?? 0) + (ws?.drinksMl ?? 0)) / profile.water.glassMl);
  const glassesOf = ws?.progress && !ws.target?.limit ? ws.progress.glassesTarget : null;
  const activeMin = today ? (today.activeMin ?? sumOrNull(today.briskMin, today.runMin)) : null;
  // Large text: the tiles stack so nothing is cut off.
  const stacked = fontScale >= 1.4;
  const toggle = (t: Tile) => onFocus(focus === t ? null : t);
  const tileStyle = stacked ? styles.tileStacked : styles.tileThird;

  return (
    <Animated.View layout={LinearTransition.duration(Motion.duration.medium)} style={styles.tilesBlock}>
      <View style={[styles.tiles, stacked && styles.tilesStacked]}>
        <StatTile
          label="Food"
          icon="restaurant-outline"
          value={formatSteps(calories.eaten)}
          unit="kcal"
          selected={focus === 'food'}
          dimmed={focus !== null && focus !== 'food'}
          onPress={() => toggle('food')}
          accessibilityHint="Shows eaten and burned"
          style={tileStyle}>
          <TickBar value={calories.eaten} max={dayBurn} tone="food" height={8} />
        </StatTile>
        <StatTile
          label="Water"
          icon="water-outline"
          value={String(glasses)}
          unit={glassesOf ? `of ${glassesOf}` : glasses === 1 ? 'glass' : 'glasses'}
          accessibilityLabel={`Water, ${glasses} ${glasses === 1 ? 'glass' : 'glasses'}${glassesOf ? ` of ${glassesOf}` : ''}`}
          selected={focus === 'water'}
          dimmed={focus !== null && focus !== 'water'}
          onPress={() => toggle('water')}
          accessibilityHint="Shows today's water"
          style={tileStyle}>
          <Button label="+1" variant="tonal" onPress={onAddGlass} accessibilityLabel="Add a glass of water" />
        </StatTile>
        <StatTile
          label="Active"
          icon="flash-outline"
          value={activeMin === null ? '—' : String(activeMin)}
          unit="min"
          selected={focus === 'active'}
          dimmed={focus !== null && focus !== 'active'}
          onPress={() => toggle('active')}
          accessibilityHint="Shows minutes on the move and distance"
          style={tileStyle}
        />
      </View>

      {focus ? (
        <Animated.View entering={FadeIn.duration(Motion.duration.short)} key={focus}>
          <Card
            level={3}
            title={focus === 'food' ? 'Food today' : focus === 'water' ? 'Water today' : 'On the move today'}
            right={<IconButton icon="close" onPress={() => onFocus(null)} accessibilityLabel="Close" />}>
            {focus === 'food' ? (
              <>
                <Figure label="Eaten" value={`${formatSteps(calories.eaten)} kcal`} />
                <Figure label="Burned so far" value={`${formatSteps(calories.burned)} kcal`} />
                <TickBar
                  value={calories.eaten}
                  max={dayBurn}
                  tone="food"
                  accessibilityLabel={`${formatSteps(calories.eaten)} of about ${formatSteps(dayBurn)} kcal`}
                />
                <View style={styles.inline}>
                  <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.grow}>
                    {`${kcalBalanceText(calories.eaten, dayBurn)} · of about ${formatSteps(dayBurn)}`}
                  </ThemedText>
                  <Why
                    title="Burned"
                    text="Burned is your resting energy (what your body uses anyway) plus your walking. Both are estimates. Add your birth year in Settings to make the resting part closer."
                  />
                </View>
                <Button label="See today's food" variant="tonal" onPress={onOpenFood} />
              </>
            ) : focus === 'water' ? (
              <WaterBody water={water} onAdded={onAdded} />
            ) : (
              <ActiveDetail />
            )}
          </Card>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function ActiveDetail() {
  const { profile, today, repo, dataVersion } = useApp();
  const router = useRouter();
  const [weather, setWeather] = useState<DayWeather | null>(null);
  const todayKey = dayKey(new Date());
  useEffect(() => {
    let live = true;
    repo.getWeather(todayKey).then((w) => live && setWeather(w));
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion]);

  const min = (v: number | null | undefined) => (v == null ? '—' : `${v} min`);
  return (
    <>
      <Figure label="Walking" value={min(today?.walkMin)} />
      <Figure label="Brisk" value={min(today?.briskMin)} />
      <Figure label="Running" value={min(today?.runMin)} />
      <Figure label="Distance" value={today ? formatDistance(today.distanceM, profile.units) : '—'} />
      {today?.floors != null ? <Figure label="Floors" value={String(today.floors)} /> : null}
      {weather ? (
        <Figure
          label="Weather"
          value={`${formatTemp(weather.tempMaxC, profile.units)}, ${CONDITION_LABEL[weather.condition]}`}
        />
      ) : null}
      <View style={styles.inline}>
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.grow}>
          Active = brisk walking and running
        </ThemedText>
        <Why
          title="Minutes on the move"
          text="Walking is 60 to 99 steps a minute, brisk is 100 to 139, running is 140 or more. Active minutes count brisk walking and running."
        />
      </View>
      <Button label="Open Activity" variant="tonal" onPress={() => router.navigate('/activity')} />
    </>
  );
}

/** Steps by the hour, the mood check-in, a goal suggestion and the weather offer: below the first screen. */
function BelowTheFold({
  weatherDay,
  onGoal,
  onLocation,
}: {
  weatherDay: string;
  onGoal: (goal: number) => void;
  onLocation: () => void;
}) {
  const { repo, profile, today, dataVersion } = useApp();
  const { mood, setMood, reminderOff, turnOnReminder } = useMoodToday();
  const [hourly, setHourly] = useState<number[]>(new Array(24).fill(0));
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const [askLocation, setAskLocation] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [h, recent, allowed, dismissed] = await Promise.all([
        repo.getHourly(weatherDay),
        repo.getDays(addDaysToKey(weatherDay, -SUGGESTION_DAYS), addDaysToKey(weatherDay, -1)),
        locationAllowed(),
        repo.getKv<boolean>(WEATHER_PROMPT_KEY),
      ]);
      if (!live) return;
      setHourly(h);
      setSuggestion(suggestGoal(recent.map((d) => d.steps), profile.dailyGoal));
      setAskLocation(!allowed && !dismissed);
    })();
    return () => {
      live = false;
    };
  }, [repo, weatherDay, dataVersion, profile.dailyGoal]);

  return (
    <>
      <SectionHeader
        title="By hour"
        why={
          today?.untimedSteps
            ? `${formatSteps(today.untimedSteps)} of today's steps came with no time, so they're in the total but in no hour. Settings → Step check shows why.`
            : undefined
        }
      />
      <BarChart
        bars={hourly.map((value, hour) => ({ key: String(hour), value, label: HOUR_LABELS[hour] ?? '' }))}
        height={120}
        name="Steps by hour"
        describeBar={(b) => `${hourName(Number(b.key))}, ${formatSteps(b.value)} steps`}
      />

      <SectionHeader title="How are you feeling?" />
      <MoodPicker value={mood?.mood ?? null} onChange={setMood} />
      {mood && reminderOff ? (
        <Button variant="text" compact label="Remind me each evening" onPress={turnOnReminder} />
      ) : null}

      {suggestion ? (
        <Card title="New goal?" right={<ThemedText type="numeralSmall">{formatSteps(suggestion)}</ThemedText>}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            From your last two weeks
          </ThemedText>
          <Button label={`Use ${formatSteps(suggestion)}`} variant="tonal" onPress={() => onGoal(suggestion)} />
        </Card>
      ) : null}

      {askLocation ? (
        <Card title="Add the weather to your days">
          <View style={styles.inline}>
            <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.grow}>
              Approximate location only
            </ThemedText>
            <Why
              title="Weather"
              text="With your approximate location, the app notes the weather each day you open it, so Insights can show how heat and rain change your walking. Your location stays on this phone."
            />
          </View>
          <View style={styles.buttons}>
            <Button
              label="Not now"
              variant="text"
              compact
              onPress={async () => {
                await repo.setKv(WEATHER_PROMPT_KEY, true);
                setAskLocation(false);
              }}
            />
            <Button
              label="Allow"
              variant="tonal"
              compact
              onPress={async () => {
                if (await requestLocation()) {
                  setAskLocation(false);
                  onLocation();
                }
              }}
            />
          </View>
        </Card>
      ) : null}
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <ThemedText type="bodyLarge" themeColor="onSurfaceVariant" style={styles.grow}>
        {label}
      </ThemedText>
      <ThemedText type="titleMedium">{value}</ThemedText>
    </View>
  );
}

function sumOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

const styles = StyleSheet.create({
  recede: { gap: Spacing.three },
  hero: { justifyContent: 'center' },
  center: { textAlign: 'center' },
  lapRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  tilesBlock: { gap: Spacing.two },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tilesStacked: { flexDirection: 'column' },
  tileThird: { flexBasis: 0, minWidth: 0 },
  tileStacked: { flexBasis: 'auto' },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
