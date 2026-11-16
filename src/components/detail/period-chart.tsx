import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { NumeralMaxScale } from '@/constants/theme';
import type { DataTone } from '@/constants/tokens';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { weekdayShort } from '@/lib/dates';
import { averageOfLogged, type TotalsKind, useDailyTotals } from '@/state/use-daily-totals';

/** Day, Week or Month: what the top of a tile's screen shows. */
export type Period = 'day' | 'week' | 'month';

export const PERIOD_DAYS: Record<Exclude<Period, 'day'>, number> = { week: 7, month: 30 };

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * The last 7 or 30 days as bars, one per day, with the average of the days
 * that have something above them. A tap on a bar opens that day.
 */
export function PeriodChart({
  kind,
  period,
  tone,
  format,
  noun,
  onPickDay,
}: {
  kind: TotalsKind;
  period: Exclude<Period, 'day'>;
  tone: DataTone;
  /** A day's value as shown, with its unit: "6,240 steps", "1.5 L", "7 h 10 min". */
  format: (value: number) => string;
  /** "Steps", "Food", "Water", "Sleep", "Walks": for the spoken chart name. */
  noun: string;
  /** A tap on a bar opens that day; without it the bars are not buttons. */
  onPickDay?: (key: string) => void;
}) {
  const days = PERIOD_DAYS[period];
  const { ready, totals } = useDailyTotals(kind, days);
  const avg = averageOfLogged(totals);
  const logged = totals.filter((t) => t.value > 0).length;
  const label = (key: string, i: number) =>
    period === 'week' ? weekdayShort(key).slice(0, 2) : i % 5 === 4 || i === totals.length - 1 ? String(Number(key.slice(8))) : '';

  return (
    <>
      <View style={styles.total} accessible accessibilityLabel={ready ? (logged ? `${format(Math.round(avg))} a day on average` : 'Nothing logged') : 'Loading'}>
        <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale} numberOfLines={1} adjustsFontSizeToFit>
          {ready && logged ? format(Math.round(avg)) : '—'}
        </ThemedText>
        <ThemedText type="titleMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {ready && logged ? `a day on average · ${logged} of ${days} days` : ready ? 'Nothing logged yet' : ''}
        </ThemedText>
      </View>
      <Card>
        <BarChart
          bars={totals.map((t, i) => ({ key: t.key, value: t.value, label: label(t.key, i) }))}
          tone={tone}
          height={180}
          name={`${noun}, last ${days} days`}
          onPressBar={onPickDay}
          describeBar={(b) => `${weekdayShort(b.key)} ${Number(b.key.slice(8))}, ${format(b.value)}`}
        />
      </Card>
      {onPickDay ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          Tap a day to open it.
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  total: { gap: CLEAN_SPEC.space.s4, marginTop: CLEAN_SPEC.space.s8 },
});
