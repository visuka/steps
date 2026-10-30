import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { GoalRing } from '@/components/goal-ring';
import { MoodPicker } from '@/components/mood-picker';
import { RecordButton } from '@/components/record-button';
import { Screen } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DayWeather } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { formatDistance, formatSteps, formatTemp, minutesAgo } from '@/lib/format';
import { SUGGESTION_DAYS, suggestGoal } from '@/lib/goals';
import { locationAllowed, requestLocation } from '@/location/place';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';
import { useMoodToday } from '@/state/use-mood';
import { walkRecorder } from '@/walks/recorder';
import { CONDITION_ICON } from '@/weather/met';

const WEATHER_PROMPT_KEY = 'weatherPromptDismissed';

const HOUR_LABELS: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };

export default function TodayScreen() {
  const { repo, profile, source, today, displaySteps, lastSyncAt, syncing, dataVersion, refresh, updateProfile } =
    useApp();
  const router = useRouter();
  const theme = useTheme();
  const { mood, setMood, reminderOff, turnOnReminder } = useMoodToday();
  const calories = useCaloriesToday();
  const [hourly, setHourly] = useState<number[]>(new Array(24).fill(0));
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const [weather, setWeather] = useState<DayWeather | null>(null);
  const [askLocation, setAskLocation] = useState(false);
  const [walking, setWalking] = useState(false);
  const todayKey = dayKey(new Date());

  useFocusEffect(
    useCallback(() => {
      walkRecorder.active().then((id) => setWalking(id !== null));
    }, []),
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const [h, recent, w, allowed, dismissed] = await Promise.all([
        repo.getHourly(todayKey),
        repo.getDays(addDaysToKey(todayKey, -SUGGESTION_DAYS), addDaysToKey(todayKey, -1)),
        repo.getWeather(todayKey),
        locationAllowed(),
        repo.getKv<boolean>(WEATHER_PROMPT_KEY),
      ]);
      if (!live) return;
      setHourly(h);
      setSuggestion(suggestGoal(recent.map((d) => d.steps), profile.dailyGoal));
      setWeather(w);
      setAskLocation(!allowed && !dismissed);
    })();
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion, profile.dailyGoal]);

  const goal = profile.dailyGoal;
  const progress = goal > 0 ? displaySteps / goal : 0;
  const left = Math.max(0, goal - displaySteps);
  const weatherLine = weather
    ? ` · ${CONDITION_ICON[weather.condition]} ${formatTemp(weather.tempMaxC, profile.units)}${weather.place ? `, ${weather.place}` : ''}`
    : '';

  return (
    <Screen
      title="Today"
      subtitle={formatDayLong(todayKey) + weatherLine}
      refreshing={syncing}
      onRefresh={refresh}
      right={
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={theme.text} />
        </Pressable>
      }>
      <Card style={styles.ringCard}>
        <GoalRing progress={progress}>
          <ThemedText style={styles.steps}>{formatSteps(displaySteps)}</ThemedText>
          <ThemedText themeColor="textSecondary">of {formatSteps(goal)} steps</ThemedText>
        </GoalRing>
        <ThemedText type="smallBold" style={styles.center}>
          {left === 0 ? 'Goal reached. Nice work.' : `${formatSteps(left)} to go`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {lastSyncAt ? `Updated ${minutesAgo(lastSyncAt)}` : 'Not synced yet'} · {source.label}
        </ThemedText>
      </Card>

      <RecordButton walking={walking} onPress={() => router.push('/walk/record')} />

      <View style={styles.tiles}>
        <StatTile icon="navigate-outline" label="Distance" value={formatDistance(today?.distanceM ?? 0, profile.units)} />
        <StatTile icon="flame-outline" label="Active kcal" value={formatSteps(today?.activeKcal ?? 0)} note="Estimated" />
        <StatTile
          icon="timer-outline"
          label="Active minutes"
          value={String(today?.activeMin ?? 0)}
          note="100+ steps a minute"
        />
        {today?.floors != null ? (
          <StatTile icon="trending-up-outline" label="Floors" value={String(today.floors)} />
        ) : null}
      </View>

      <Card title="How are you feeling today?">
        <MoodPicker value={mood?.mood ?? null} onChange={setMood} />
        {mood && reminderOff ? (
          <Button kind="secondary" label="Remind me each evening" onPress={turnOnReminder} />
        ) : null}
      </Card>

      <Card title="Calories">
        <View style={styles.calories}>
          <CalorieFigure label="Eaten" value={calories.eaten} />
          <CalorieFigure label="Burned so far" value={calories.burned} />
        </View>
        <Button
          kind="secondary"
          label="Log food"
          onPress={() => router.push({ pathname: '/journal', params: { section: 'food' } })}
        />
      </Card>

      {askLocation ? (
        <Card title="Add the weather to your days">
          <ThemedText themeColor="textSecondary">
            With your approximate location, Steps notes the weather each day you open it, so Insights can show how heat
            and rain change your walking. Your location stays on this phone.
          </ThemedText>
          <Button
            label="Allow location"
            onPress={async () => {
              if (await requestLocation()) {
                setAskLocation(false);
                refresh();
              }
            }}
          />
          <Button
            kind="secondary"
            label="Not now"
            onPress={async () => {
              await repo.setKv(WEATHER_PROMPT_KEY, true);
              setAskLocation(false);
            }}
          />
        </Card>
      ) : null}

      <Card title="By hour">
        <BarChart
          bars={hourly.map((value, hour) => ({ key: String(hour), value, label: HOUR_LABELS[hour] ?? '' }))}
          height={120}
        />
      </Card>

      {suggestion ? (
        <Card title="Ready for a new goal?">
          <ThemedText themeColor="textSecondary">
            Your last two weeks suggest {formatSteps(suggestion)} steps a day.
          </ThemedText>
          <Button label={`Use ${formatSteps(suggestion)}`} onPress={() => updateProfile({ dailyGoal: suggestion })} />
        </Card>
      ) : null}
    </Screen>
  );
}

function CalorieFigure({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.calorieFigure}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.calorieValue}>{formatSteps(value)} kcal</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  calories: { flexDirection: 'row', gap: Spacing.three },
  calorieFigure: { flex: 1, gap: Spacing.half },
  calorieValue: { fontSize: 22, lineHeight: 28, fontWeight: 700, fontVariant: ['tabular-nums'] },
  ringCard: { alignItems: 'center', paddingVertical: Spacing.four },
  steps: { fontSize: 44, lineHeight: 52, fontWeight: 700, fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
