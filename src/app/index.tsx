import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { GoalRing } from '@/components/goal-ring';
import { Screen } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { formatDistance, formatSteps, minutesAgo } from '@/lib/format';
import { SUGGESTION_DAYS, suggestGoal } from '@/lib/goals';
import { useApp } from '@/state/app-state';

const HOUR_LABELS: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };

export default function TodayScreen() {
  const { repo, profile, source, today, displaySteps, lastSyncAt, syncing, dataVersion, refresh, updateProfile } =
    useApp();
  const [hourly, setHourly] = useState<number[]>(new Array(24).fill(0));
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const todayKey = dayKey(new Date());

  useEffect(() => {
    let live = true;
    (async () => {
      const [h, recent] = await Promise.all([
        repo.getHourly(todayKey),
        repo.getDays(addDaysToKey(todayKey, -SUGGESTION_DAYS), addDaysToKey(todayKey, -1)),
      ]);
      if (!live) return;
      setHourly(h);
      setSuggestion(suggestGoal(recent.map((d) => d.steps), profile.dailyGoal));
    })();
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion, profile.dailyGoal]);

  const goal = profile.dailyGoal;
  const progress = goal > 0 ? displaySteps / goal : 0;
  const left = Math.max(0, goal - displaySteps);

  return (
    <Screen title="Today" subtitle={formatDayLong(todayKey)} refreshing={syncing} onRefresh={refresh}>
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

const styles = StyleSheet.create({
  ringCard: { alignItems: 'center', paddingVertical: Spacing.four },
  steps: { fontSize: 44, lineHeight: 52, fontWeight: 700, fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
