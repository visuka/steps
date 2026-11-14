import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HourBars, NutrientRow } from '@/components/ui';
import { HOUR_CHART, groupThousands, hourRange } from '@/components/ui/hour-bars-geometry';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';
import { quarterClock, quartersOfHour, seriesLabel, share } from '@/state/series';

/** The hours the axis names under the bars (12 am, 6 am, 12 pm, 6 pm). */
const AXIS: readonly { hour: number; text: string }[] = [
  { hour: 0, text: '12 am' },
  { hour: 6, text: '6 am' },
  { hour: 12, text: '12 pm' },
  { hour: 18, text: '6 pm' },
];

export interface SeriesChartProps {
  /** 24 values, hour 0 to 23. */
  hours: readonly number[];
  /** Noun for the spoken summary and the taps: 'Steps', 'Active minutes', 'Food', 'Water'. */
  what: string;
  /** 'steps', 'min', 'kcal', 'ml'. */
  unit: string;
  /** Steps only: the day's goal for the goal line; 0 draws none. */
  goal?: number;
  /** Today's current hour: later hours are quiet. Omit for past days. */
  now?: number | null;
  /** With this, a tap on an hour selects it. */
  selected?: number | null;
  onSelect?: (hour: number | null) => void;
}

/**
 * The T5 hour bars on white (HourBars tone 'plain'), 24 slots, with one
 * invisible tap target per hour on top when `onSelect` is given. The selected
 * hour gets a primaryContainer slot behind its bar.
 */
export function SeriesChart({ hours, what, unit, goal = 0, now, selected, onSelect }: SeriesChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const pitch = width / HOUR_CHART.slots;

  return (
    <View onLayout={onLayout}>
      <View style={{ height: HOUR_CHART.height }}>
        {selected != null && width > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.slot, { left: selected * pitch, width: pitch, backgroundColor: theme.primaryContainer }]}
          />
        ) : null}
        <View accessible accessibilityRole="image" accessibilityLabel={seriesLabel(what, unit, hours)}>
          <HourBars hours={hours} goal={goal} width={width || undefined} now={now} tone="plain" />
        </View>
        {onSelect && width > 0
          ? hours.map((v, h) => (
              <Pressable
                key={h}
                onPress={() => onSelect(selected === h ? null : h)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === h }}
                accessibilityLabel={`${hourRange(h)}, ${groupThousands(v)} ${unit}`}
                style={[styles.tap, { left: h * pitch, width: pitch }]}
              />
            ))
          : null}
      </View>
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {AXIS.map((a) => (
          <ThemedText key={a.hour} type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {a.text}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

/** One hour as four 15-minute rows: the clock, a 4 dp bar, the value (the T5 nutrient row). */
export function QuarterRows({ quarters, hour, unit }: { quarters: readonly number[]; hour: number; unit: string }) {
  const q = quartersOfHour(quarters, hour);
  const max = Math.max(...q);
  return (
    <View>
      {q.map((v, i) => (
        <NutrientRow key={i} name={quarterClock(hour, i)} value={`${groupThousands(v)} ${unit}`} share={share(v, max)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', top: 0, bottom: 0, borderRadius: CLEAN_SPEC.radius.bar },
  tap: { position: 'absolute', top: 0, bottom: 0 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: CLEAN_SPEC.space.s8 },
});
