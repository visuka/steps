import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { ConnectHealth } from '@/components/journal/connect-health';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { HeartDay } from '@/data/types';
import { addDaysToKey, dayKey, weekdayShort } from '@/lib/dates';
import { restingWeekChange } from '@/lib/vitals-insights';
import { useApp } from '@/state/app-state';
import { useVitalsConnection } from '@/state/use-vitals';

const CHART_DAYS = 14;

/** Heart rate read from a watch or band; the app doesn't measure it itself. */
export function HeartLog() {
  const { repo, dataVersion } = useApp();
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

  return (
    <>
      <ConnectHealth what="heart rate and sleep" />

      {days.length === 0 ? (
        <Card title="Heart rate">
          <ThemedText themeColor="textSecondary">
            {vitals.connected
              ? `No heart rate in ${vitals.label} yet. It comes from a watch or band whose app saves there.`
              : 'Heart rate comes from a watch or band. Steps reads it; the phone can’t measure it.'}
          </ThemedText>
        </Card>
      ) : (
        <>
          <Card title="Resting heart rate">
            {week ? (
              <>
                <View style={styles.headline}>
                  <ThemedText style={styles.big}>{week.week}</ThemedText>
                  <ThemedText themeColor="textSecondary">bpm, last 7 days</ThemedText>
                </View>
                {week.before !== null ? (
                  <ThemedText>
                    {week.week === week.before
                      ? 'Same as the week before.'
                      : `${Math.abs(week.week - week.before)} bpm ${week.week < week.before ? 'lower' : 'higher'} than the week before (${week.before}).`}
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText themeColor="textSecondary">Your watch hasn&apos;t reported a resting heart rate this week.</ThemedText>
            )}
            {hasResting ? (
              <BarChart
                bars={chartDays.map((date, i) => ({
                  key: date,
                  value: byDate.get(date)?.restingBpm ?? 0,
                  label: i % 2 === 1 ? weekdayShort(date).slice(0, 2) : '',
                }))}
                height={80}
              />
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Over weeks of regular walking, resting heart rate often drifts down. Day to day it moves with sleep,
              stress, illness, caffeine and heat, so look at the trend, not one day.
            </ThemedText>
          </Card>

          {latest ? (
            <Card title={latest.date === today ? 'Today' : 'Latest day'}>
              <ThemedText>
                Average {latest.avgBpm} bpm
                {latest.minBpm !== null && latest.maxBpm !== null ? ` · lowest ${latest.minBpm} · highest ${latest.maxBpm}` : ''}
              </ThemedText>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  big: { fontSize: 32, lineHeight: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
