import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { confirmDelete } from '@/components/confirm';
import { Segmented } from '@/components/controls';
import { type Period, PERIOD_OPTIONS, PeriodChart } from '@/components/detail/period-chart';
import { QuarterRows, SeriesChart } from '@/components/detail/series-chart';
import { BodyLog } from '@/components/journal/body-log';
import { EntryList, EntryRow } from '@/components/journal/entry-parts';
import { MoodLog } from '@/components/journal/mood-log';
import { SleepLog } from '@/components/journal/sleep-log';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ListRow, Notice, NutrientRow, Pill, Screen, SectionHeader, SpecIcon } from '@/components/ui';
import type { DataTone } from '@/constants/tokens';
import { deleteFood } from '@/data/entries';
import { copyStore } from '@/health/select-source';
import { SCREEN_FEATURES } from '@/premium/premium';
import type { TotalsKind } from '@/state/use-daily-totals';
import { groupThousands, hourRange } from '@/components/ui/hour-bars-geometry';
import { NumeralMaxScale } from '@/constants/theme';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, formatDayLong } from '@/lib/dates';
import { formatSteps, formatWater } from '@/lib/format';
import { useApp } from '@/state/app-state';
import {
  clockAt,
  dayEndMs,
  dayStartMs,
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
import { useWaterToday } from '@/state/use-water';
import { useClock } from '@/hooks/use-clock';

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
  const today = useClock().today;
  if (!kind) {
    return (
      <Screen title="Detail" onBack={() => router.back()}>
        <EmptyState icon="help-circle-outline" title="Nothing to show here" />
      </Screen>
    );
  }
  const first = isDayKey(date) && date <= today ? date : today;
  return <Detail kind={kind} firstDay={first} />;
}

/** The screen itself, for the route above and the design preview (which has no [kind] segment to read). */
export function Detail({ kind, firstDay }: { kind: SeriesKind; firstDay: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useApp();
  const [day, setDay] = useState(firstDay);
  // Day, Week or Month at the top (owner, 16 Nov 2026: each tile's screen shows a graph over time).
  const [period, setPeriod] = useState<Period>('day');
  const [hour, setHour] = useState<number | null>(null);
  const clock = useClock();
  const today = clock.today;
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
  const nowHour = isToday ? wallHour(clock.now, tz) : null;

  const dayLabel = isToday ? 'Today' : day === addDaysToKey(today, -1) ? 'Yesterday' : formatDayLong(day);

  return (
    <Screen title={TITLES[kind]} subtitle={period === 'day' ? formatDayLong(day) : undefined} onBack={() => router.back()}>
      <Segmented<Period> options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

      {period !== 'day' ? (
        <PeriodChart
          kind={kind as TotalsKind}
          period={period}
          tone={TONES[kind]}
          noun={TITLES[kind]}
          format={(v) => periodText(kind, v, units)}
          onPickDay={(key) => {
            go(key);
            setPeriod('day');
          }}
        />
      ) : (
      <>
      <View style={styles.dayRow}>
        <DayArrow label="Previous day" icon="chevron-left" disabled={!prev} onPress={() => go(prev)} color={theme.onSurface} />
        <Pill label={dayLabel} />
        <DayArrow label="Next day" icon="chevron-right" disabled={!next} onPress={() => go(next)} color={theme.onSurface} />
      </View>

      {kind === 'steps' ? (
        <Total value={formatSteps(total)} unit={profile.dailyGoal > 0 ? `of ${formatSteps(profile.dailyGoal)} steps` : 'steps'} />
      ) : null}
      {kind === 'active' ? (
        <Total
          value={
            series.minutesMissing
              ? series.ready && series.storedActiveMin != null
                ? formatMinutes(series.storedActiveMin)
                : '—'
              : formatMinutes(total)
          }
          unit="active"
        />
      ) : null}
      {kind === 'food' ? <Total value={groupThousands(total)} unit="kcal" /> : null}
      {kind === 'water' ? <Total value={formatWater(total, units)} /> : null}

      {kind === 'steps' ? (
        <>
          <SectionHeader title="By hour" />
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
          {series.minutesMissing ? null : (
            <>
              <SectionHeader title="By hour" />
              <Card>
                <SeriesChart hours={series.hours} what="Active minutes" unit="min" now={nowHour} />
              </Card>
            </>
          )}
          {series.ready && series.minutesMissing ? (
            <Note text="Minute data not available for this day, so only the day's total is shown." />
          ) : null}
        </>
      ) : null}

      {kind === 'food' || kind === 'water' ? (
        <>
          <SectionHeader title="By hour" />
          <Card>
            <SeriesChart hours={series.hours} what={TITLES[kind]} unit={kind === 'food' ? 'kcal' : 'ml'} now={nowHour} />
          </Card>
        </>
      ) : null}

      {kind === 'food' ? <FoodEntries day={day} entries={series.entries} ready={series.ready} /> : null}

      {(kind === 'food' || kind === 'water') && series.hours.some((v) => v > 0) ? (
        <>
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
      ) : null}

      {kind === 'sleep' ? <SleepBody nights={series.nights} ready={series.ready} tz={tz} /> : null}
      </>
      )}

      {/* Add and remove, under the graph, so Today's tile leads straight to it (owner, 16 Nov 2026). */}
      {kind === 'water' ? (
        <>
          <SectionHeader gap="sub" title="Add or remove" />
          <PremiumGate feature={SCREEN_FEATURES['journal/water']}>
            <BodyLog kind="water" total={false} />
            <WaterSnooze />
          </PremiumGate>
        </>
      ) : null}
      {kind === 'sleep' ? (
        <>
          <SectionHeader gap="sub" title="Add or remove" />
          <PremiumGate feature={SCREEN_FEATURES['journal/sleep']}>
            <SleepLog chart={false} />
          </PremiumGate>
          <SectionHeader gap="sub" title="Mood" />
          <PremiumGate feature={SCREEN_FEATURES['journal/mood']}>
            <MoodLog />
          </PremiumGate>
        </>
      ) : null}
      {kind === 'food' ? <Button icon="add" label="Log food" onPress={() => router.navigate('/food')} /> : null}
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

/** The day's total, large, under the day picker: the first thing the screen says. */
function Total({ value, unit }: { value: string; unit?: string }) {
  return (
    <View style={styles.total} accessible accessibilityLabel={unit ? `${value} ${unit}` : value}>
      <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {unit ? (
        <ThemedText type="titleMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.unit}>
          {unit}
        </ThemedText>
      ) : null}
    </View>
  );
}

const TONES: Record<SeriesKind, DataTone> = { steps: 'steps', active: 'steps', food: 'food', water: 'water', sleep: 'sleep' };

/** A day's total in the Week and Month charts, with its unit. */
function periodText(kind: SeriesKind, v: number, units: Parameters<typeof formatWater>[1]): string {
  if (kind === 'steps') return `${formatSteps(v)} steps`;
  if (kind === 'food') return `${groupThousands(v)} kcal`;
  if (kind === 'water') return formatWater(v, units);
  return formatMinutes(v);
}

/** The day's food, each with Delete; tapping Log food below adds more. */
function FoodEntries({ day, entries, ready }: { day: string; entries: ReturnType<typeof useSeries>['entries']; ready: boolean }) {
  const { repo, touch } = useApp();
  const [gone, setGone] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const shown = entries.filter((e) => !gone.includes(e.id));
  const remove = async (id: string) => {
    setGone((g) => [...g, id]);
    setNote(null);
    try {
      const found = (await repo.getFoods(dayStartMs(day, deviceZone), dayEndMs(day, deviceZone))).find((f) => f.id === id);
      if (found && (await deleteFood(repo, copyStore, found)) === 'failed') {
        setNote(`Deleted here, but couldn't delete the copy in ${copyStore.label}.`);
      }
    } catch {
      setGone((g) => g.filter((x) => x !== id));
      setNote("Couldn't delete that entry. Please try again.");
    }
    touch();
  };
  return (
    <>
      <SectionHeader gap="sub" title="Eaten" />
      {shown.length === 0 ? (
        <Note text={ready ? 'No food logged on this day.' : '—'} />
      ) : (
        <EntryList>
          {shown.map((e) => (
            <EntryRow
              key={e.id}
              title={`${e.name ?? 'Food'} · ${groupThousands(e.value)} kcal`}
              supporting={clockAt(e.at, deviceZone)}
              onDelete={() => confirmDelete('entry', () => remove(e.id))}
              deleteLabel={`Delete ${e.name ?? 'this food'}`}
            />
          ))}
        </EntryList>
      )}
      {note ? <Notice tone="problem" text={note} /> : null}
    </>
  );
}

function Note({ text }: { text: string }) {
  return (
    <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
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
  total: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: CLEAN_SPEC.space.s8, marginTop: CLEAN_SPEC.space.s16 },
  unit: { flexShrink: 1 },
  arrow: {
    width: CLEAN_SPEC.sizes.nav.minTouch,
    height: CLEAN_SPEC.sizes.nav.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Spec 10.3: disabled = same colours at opacity 0.4.
  disabled: { opacity: 0.4 },
});

/** After a water reminder today: stop the rest of today's (was on the Food tab's Water card). */
function WaterSnooze() {
  const water = useWaterToday();
  const s = water.status;
  if (!s?.remindedToday || s.snoozed) return null;
  return <Button label="No more reminders today" variant="text" compact onPress={water.snooze} />;
}
