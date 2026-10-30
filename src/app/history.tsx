import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { type Bar, BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { Segmented } from '@/components/controls';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DaySummary } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDays, dayKey, daysBetween, formatDayLong, monthShort, parseDayKey, weekdayShort } from '@/lib/dates';
import { formatDistance, formatSteps } from '@/lib/format';
import { useApp } from '@/state/app-state';

type Range = 'day' | 'week' | 'month' | 'year';

const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const HOUR_LABELS: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };

/** First and last day of the period `offset` steps back from today. Weeks start on Monday. */
function period(range: Range, offset: number, today: Date): { start: Date; end: Date } {
  if (range === 'day') {
    const d = addDays(today, -offset);
    return { start: d, end: d };
  }
  if (range === 'week') {
    const d = addDays(today, -7 * offset);
    const start = addDays(d, -((d.getDay() + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  if (range === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 0) };
  }
  const year = today.getFullYear() - offset;
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
}

function periodTitle(range: Range, start: Date, end: Date): string {
  if (range === 'day') return formatDayLong(dayKey(start));
  if (range === 'week') {
    return `${start.getDate()} ${monthShort(start.getMonth())} – ${end.getDate()} ${monthShort(end.getMonth())}`;
  }
  if (range === 'month') return `${monthShort(start.getMonth())} ${start.getFullYear()}`;
  return String(start.getFullYear());
}

export default function HistoryScreen() {
  const { repo, profile, dataVersion } = useApp();
  const [range, setRange] = useState<Range>('week');
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [hourly, setHourly] = useState<number[]>(new Array(24).fill(0));

  const todayDate = new Date();
  const { start, end } = period(range, offset, todayDate);
  const startKey = dayKey(start);
  const endKey = dayKey(end);

  useEffect(() => {
    let live = true;
    (async () => {
      const [rows, h] = await Promise.all([
        repo.getDays(startKey, endKey),
        range === 'day' ? repo.getHourly(startKey) : Promise.resolve(null),
      ]);
      if (!live) return;
      setDays(rows);
      if (h) setHourly(h);
    })();
    return () => {
      live = false;
    };
  }, [repo, startKey, endKey, range, dataVersion]);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const bars: Bar[] = [];
  if (range === 'day') {
    hourly.forEach((value, hour) => bars.push({ key: String(hour), value, label: HOUR_LABELS[hour] ?? '' }));
  } else if (range === 'year') {
    for (let m = 0; m < 12; m++) {
      const inMonth = days.filter((d) => parseDayKey(d.date).getMonth() === m);
      const avg = inMonth.length ? inMonth.reduce((s, d) => s + d.steps, 0) / inMonth.length : 0;
      bars.push({ key: String(m), value: Math.round(avg), label: monthShort(m).slice(0, 1) });
    }
  } else {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = dayKey(d);
      const label =
        range === 'week' ? weekdayShort(key).slice(0, 2) : [1, 8, 15, 22, 29].includes(d.getDate()) ? String(d.getDate()) : '';
      bars.push({ key, value: byDate.get(key)?.steps ?? 0, label });
    }
  }

  const withData = days.filter((d) => d.steps > 0);
  const total = withData.reduce((s, d) => s + d.steps, 0);
  const best = withData.reduce<DaySummary | null>((b, d) => (!b || d.steps > b.steps ? d : b), null);
  const goalDays = withData.filter((d) => d.steps >= d.goal).length;
  const dayRow = range === 'day' ? byDate.get(startKey) : undefined;

  const openDay = (key: string) => {
    setRange('day');
    setOffset(daysBetween(key, dayKey(todayDate)));
  };

  return (
    <Screen title="History">
      <Segmented
        options={RANGES}
        value={range}
        onChange={(r) => {
          setRange(r);
          setOffset(0);
        }}
      />

      <View style={styles.nav}>
        <NavButton icon="chevron-back" label="Earlier" onPress={() => setOffset(offset + 1)} />
        <ThemedText type="smallBold">{periodTitle(range, start, end)}</ThemedText>
        <NavButton icon="chevron-forward" label="Later" onPress={() => setOffset(offset - 1)} disabled={offset === 0} />
      </View>

      <Card>
        <BarChart
          bars={bars}
          goal={range === 'day' ? undefined : profile.dailyGoal}
          onPressBar={range === 'week' || range === 'month' ? openDay : undefined}
        />
        {range === 'week' || range === 'month' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap a day for its hourly detail. Dashed line: your goal.
          </ThemedText>
        ) : null}
      </Card>

      {range === 'day' ? (
        <View style={styles.summary}>
          <Summary label="Steps" value={formatSteps(dayRow?.steps ?? 0)} />
          <Summary label="Distance" value={formatDistance(dayRow?.distanceM ?? 0, profile.units)} />
          <Summary label="Active kcal" value={formatSteps(dayRow?.activeKcal ?? 0)} />
          <Summary label="Active min" value={dayRow?.activeMin == null ? '—' : String(dayRow.activeMin)} />
        </View>
      ) : (
        <View style={styles.summary}>
          <Summary label="Daily average" value={formatSteps(withData.length ? total / withData.length : 0)} />
          <Summary label="Total" value={formatSteps(total)} />
          <Summary label="Goal days" value={`${goalDays} / ${withData.length}`} />
          <Summary
            label="Best day"
            value={best ? formatSteps(best.steps) : '—'}
            note={best ? formatDayLong(best.date) : undefined}
          />
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Calories are estimates. Days older than a week show daily totals only.
      </ThemedText>
    </Screen>
  );
}

function NavButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={{ opacity: disabled ? 0.3 : 1 }}>
      <Ionicons name={icon} size={22} color={theme.text} />
    </Pressable>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryInner}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.summaryValue}>{value}</ThemedText>
        {note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.one },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  summaryCard: { flexGrow: 1, flexBasis: '45%' },
  summaryInner: { gap: Spacing.half },
  summaryValue: { fontSize: 22, lineHeight: 28, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
