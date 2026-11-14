import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QuarterRows, SeriesChart } from '@/components/detail/series-chart';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ListRow, NutrientRow, Pill, Screen, SectionHeader, SpecIcon } from '@/components/ui';
import { groupThousands, hourRange } from '@/components/ui/hour-bars-geometry';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { formatSteps, formatWater } from '@/lib/format';
import { useApp } from '@/state/app-state';
import {
  clockAt,
  deviceZone,
  formatMinutes,
  isDayKey,
  parseKind,
  type SeriesKind,
  share,
  shiftDay,
  sum,
  wallHour,
  type Zone,
} from '@/state/series';
import { useSeries } from '@/state/use-series';

const TITLES: Record<SeriesKind, string> = {
  steps: 'Steps',
  active: 'Active minutes',
  food: 'Food',
  water: 'Water',
  sleep: 'Sleep',
};

/** /detail/<kind>, optionally ?date=YYYY-MM-DD. 'walk' is not a kind: the walk tile opens the walk screen. */
export default function DetailRoute() {
  const { kind: rawKind, date } = useLocalSearchParams<{ kind: string; date?: string }>();
  const router = useRouter();
  const kind = parseKind(rawKind);
  if (!kind) {
    return (
      <Screen title="Detail" onBack={() => router.back()}>
        <EmptyState icon="help-circle-outline" title="Nothing to show here" />
      </Screen>
    );
  }
  const today = dayKey(new Date());
  const first = isDayKey(date) && date <= today ? date : today;
  return <Detail kind={kind} firstDay={first} />;
}

function Detail({ kind, firstDay }: { kind: SeriesKind; firstDay: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useApp();
  const [day, setDay] = useState(firstDay);
  const [hour, setHour] = useState<number | null>(null);
  const today = dayKey(new Date());
  const isToday = day === today;
  const series = useSeries(kind, day);

  const prev = shiftDay(day, -1, today);
  const next = shiftDay(day, 1, today);
  const go = (to: string | null) => {
    if (!to) return;
    setDay(to);
    setHour(null);
  };

  const total = sum(series.hours);
  const units = profile.units;
  const tz = deviceZone;
  const nowHour = isToday ? wallHour(new Date().getTime(), tz) : null;

  const dayLabel = isToday ? 'Today' : day === addDaysToKey(today, -1) ? 'Yesterday' : formatDayLong(day);

  return (
    <Screen title={TITLES[kind]} subtitle={formatDayLong(day)} onBack={() => router.back()}>
      <View style={styles.dayRow}>
        <DayArrow label="Previous day" icon="chevron-left" disabled={!prev} onPress={() => go(prev)} color={theme.onSurface} />
        <Pill label={dayLabel} />
        <DayArrow label="Next day" icon="chevron-right" disabled={!next} onPress={() => go(next)} color={theme.onSurface} />
      </View>

      {kind === 'steps' ? (
        <>
          <SectionHeader title="By hour" caption={`${formatSteps(total)} steps`} />
          <Card>
            <SeriesChart
              hours={series.hours}
              what="Steps"
              unit="steps"
              goal={profile.dailyGoal}
              now={nowHour}
              selected={series.quarters ? hour : null}
              onSelect={series.quarters ? setHour : undefined}
            />
          </Card>
          {series.quarters && hour != null ? (
            <>
              <SectionHeader gap="sub" title={hourRange(hour)} caption={`${formatSteps(series.hours[hour] ?? 0)} steps`} />
              <Card>
                <QuarterRows quarters={series.quarters} hour={hour} unit="steps" />
              </Card>
            </>
          ) : null}
          {series.ready ? (
            <Note
              text={
                series.quarters
                  ? 'Tap an hour to see it in 15-minute bars.'
                  : 'Hourly only: 15-minute detail is kept for the last 7 days.'
              }
            />
          ) : null}
        </>
      ) : null}

      {kind === 'active' ? (
        <>
          <SectionHeader title="By hour" caption={series.minutesMissing ? undefined : formatMinutes(total)} />
          {series.minutesMissing ? (
            <Card>
              <ThemedText type="bodyLarge" maxFontSizeMultiplier={1.3}>
                {series.ready && series.storedActiveMin != null ? formatMinutes(series.storedActiveMin) : '—'}
              </ThemedText>
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
                Active minutes for the day
              </ThemedText>
            </Card>
          ) : (
            <Card>
              <SeriesChart hours={series.hours} what="Active minutes" unit="min" now={nowHour} />
            </Card>
          )}
          {series.ready && series.minutesMissing ? (
            <Note text="Minute data not available for this day, so only the day's total is shown." />
          ) : null}
        </>
      ) : null}

      {kind === 'food' || kind === 'water' ? (
        <>
          <SectionHeader title="By hour" caption={kind === 'food' ? `${groupThousands(total)} kcal` : formatWater(total, units)} />
          <Card>
            <SeriesChart hours={series.hours} what={TITLES[kind]} unit={kind === 'food' ? 'kcal' : 'ml'} now={nowHour} />
          </Card>
          <SectionHeader gap="sub" title="Entries" />
          {series.entries.length === 0 ? (
            <Note
              text={series.ready ? (kind === 'food' ? 'No food logged on this day.' : 'No water logged on this day.') : '—'}
            />
          ) : (
            <>
              <Card>
                {series.entries.map((e, i) => (
                  <ListRow
                    key={e.id}
                    title={e.name ?? 'Water'}
                    supporting={clockAt(e.at, tz)}
                    trailingText={kind === 'food' ? `${groupThousands(e.value)} kcal` : formatWater(e.value, units)}
                    last={i === series.entries.length - 1}
                  />
                ))}
              </Card>
              <SectionHeader gap="sub" title="Total per hour" />
              <Card>
                {series.hours
                  .map((v, h) => ({ v, h }))
                  .filter((x) => x.v > 0)
                  .map((x, i, all) => (
                    <ListRow
                      key={x.h}
                      title={hourRange(x.h)}
                      trailingText={kind === 'food' ? `${groupThousands(x.v)} kcal` : formatWater(x.v, units)}
                      last={i === all.length - 1}
                    />
                  ))}
              </Card>
            </>
          )}
        </>
      ) : null}

      {kind === 'sleep' ? <SleepBody nights={series.nights} ready={series.ready} tz={tz} /> : null}
    </Screen>
  );
}

function SleepBody({ nights, ready, tz }: { nights: ReturnType<typeof useSeries>['nights']; ready: boolean; tz: Zone }) {
  if (nights.length === 0) {
    return ready ? <EmptyState icon="moon-outline" title="No sleep data for this day" /> : <Note text="—" />;
  }
  const asleep = sum(nights.map((n) => n.asleepMin));
  const withStages = nights.filter((n) => n.stages);
  const stages = withStages.reduce(
    (a, n) => ({
      awake: a.awake + (n.stages?.awake ?? 0),
      light: a.light + (n.stages?.light ?? 0),
      deep: a.deep + (n.stages?.deep ?? 0),
      rem: a.rem + (n.stages?.rem ?? 0),
    }),
    { awake: 0, light: 0, deep: 0, rem: 0 },
  );
  const stageTotal = sum(Object.values(stages));
  const rows: [string, number][] = [
    ['Deep', stages.deep],
    ['Light', stages.light],
    ['REM', stages.rem],
    ['Awake', stages.awake],
  ];
  return (
    <>
      <SectionHeader title="Night" caption={formatMinutes(asleep)} />
      <Card>
        {nights.map((n, i) => (
          <ListRow
            key={n.id}
            title={`${clockAt(n.startAt, tz)} to ${clockAt(n.endAt, tz)}`}
            trailingText={formatMinutes(n.asleepMin)}
            last={i === nights.length - 1}
          />
        ))}
      </Card>
      <SectionHeader gap="sub" title="Stages" />
      {withStages.length === 0 ? (
        <Note text="Stages are not available for this night." />
      ) : (
        <Card>
          {rows.map(([name, min]) => (
            <NutrientRow key={name} name={name} value={formatMinutes(min)} share={share(min, stageTotal)} />
          ))}
        </Card>
      )}
    </>
  );
}

function Note({ text }: { text: string }) {
  return (
    <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
      {text}
    </ThemedText>
  );
}

function DayArrow({
  label,
  icon,
  disabled,
  onPress,
  color,
}: {
  label: string;
  icon: 'chevron-left' | 'chevron-right';
  disabled: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.arrow, disabled && styles.disabled]}>
      <SpecIcon name={icon} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: CLEAN_SPEC.sizes.nav.minTouch,
    height: CLEAN_SPEC.sizes.nav.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Spec 10.3: disabled = same colours at opacity 0.4.
  disabled: { opacity: 0.4 },
});
