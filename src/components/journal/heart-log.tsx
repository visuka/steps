import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { ConnectHealth } from '@/components/journal/connect-health';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, SectionHeader, StatTile } from '@/components/ui';
import { NumeralMaxScale, Spacing } from '@/constants/theme';
import type { HeartDay } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, formatDayLong, weekdayShort } from '@/lib/dates';
import { restingWeekChange } from '@/lib/vitals-insights';
import { useApp } from '@/state/app-state';
import { useVitalsConnection } from '@/state/use-vitals';

const CHART_DAYS = 14;

const TREND_WHY =
  'Over weeks of regular walking, resting heart rate often drifts down. Day to day it moves with sleep, stress, illness, caffeine and heat, so look at the trend, not one day.';

/** Heart rate read from a watch or band; the app doesn't measure it itself. */
export function HeartLog() {
  const { repo, dataVersion } = useApp();
  const theme = useTheme();
  const vitals = useVitalsConnection();
  const [days, setDays] = useState<HeartDay[] | null>(null);
  const today = dayKey(new Date());

  useEffect(() => {
    let live = true;
    repo.getHeartDays(addDaysToKey(today, -CHART_DAYS + 1), today).then((d) => live && setDays(d));
    return () => {
      live = false;
    };
  }, [repo, today, dataVersion]);

  if (!days) return null;

  const week = restingWeekChange(days, today);
  const latest = [...days].reverse().find((d) => d.avgBpm !== null) ?? null;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const chartDays = Array.from({ length: CHART_DAYS }, (_, i) => addDaysToKey(today, i - CHART_DAYS + 1));
  const hasResting = days.some((d) => d.restingBpm !== null);
  const store = vitals.label ?? 'your watch';

  const change =
    week && week.before !== null
      ? week.week === week.before
        ? 'Same as the week before'
        : `${Math.abs(week.week - week.before)} bpm ${week.week < week.before ? 'lower' : 'higher'} than the week before`
      : null;

  return (
    <>
      <ConnectHealth what="heart rate and sleep" />

      {days.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="No heart rate yet"
          hint={vitals.connected ? `Nothing in ${vitals.label} yet. It comes from a watch or band.` : 'It comes from a watch or band.'}
        />
      ) : (
        <>
          <SectionHeader title="Resting heart rate" why={TREND_WHY} />
          <Card>
            {week ? (
              <View style={styles.hero}>
                <View style={styles.value}>
                  <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale}>
                    {week.week}
                  </ThemedText>
                  <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
                    bpm · last 7 days
                  </ThemedText>
                </View>
                {change ? <ThemedText type="bodyMedium">{change}</ThemedText> : null}
              </View>
            ) : (
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
                No resting heart rate this week.
              </ThemedText>
            )}
            {hasResting ? (
              <BarChart
                bars={chartDays.map((date, i) => ({
                  key: date,
                  value: byDate.get(date)?.restingBpm ?? 0,
                  label: i % 2 === 1 ? weekdayShort(date).slice(0, 2) : '',
                }))}
                color={theme.outline}
                height={80}
                name="Resting heart rate, past week"
                describeBar={(b) => `${formatDayLong(b.key)}, ${b.value ? `${b.value} beats a minute` : 'none'}`}
              />
            ) : null}
            <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
              From {store}. Change it in the app that made it.
            </ThemedText>
          </Card>

          {latest ? (
            <>
              <SectionHeader title={latest.date === today ? 'Today' : 'Latest day'} />
              <View style={styles.tiles}>
                <StatTile label="Average" value={String(latest.avgBpm)} unit="bpm" style={styles.tile} />
                {latest.minBpm !== null ? (
                  <StatTile label="Lowest" value={String(latest.minBpm)} unit="bpm" style={styles.tile} />
                ) : null}
                {latest.maxBpm !== null ? (
                  <StatTile label="Highest" value={String(latest.maxBpm)} unit="bpm" style={styles.tile} />
                ) : null}
              </View>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.one },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: { flexBasis: 0, minWidth: 0 },
});
