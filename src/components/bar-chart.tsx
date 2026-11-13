import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type DataTone, Radius, Spacing, toneColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';

import { chartSummary } from './bar-chart-speech';

const LABEL_WIDTH = 40;

export interface Bar {
  key: string;
  value: number;
  /** Axis label; empty string to skip. */
  label: string;
}

/**
 * Plain-View bars: light enough for 24 hourly bars or 31 daily ones. Bars at
 * or over `goal` take the data colour (`tone`, steps by default), the rest
 * stay the quiet lane; a dashed line marks the goal. With no goal every bar
 * takes the colour; `color` gives a neutral one instead, for data with no
 * colour of its own (heart rate, weight).
 *
 * For TalkBack: with `onPressBar` each bar is a button named by `describeBar`
 * ("1 pm, 2,140 steps"); without it the bars are hidden and the chart is one
 * element that says `name` and its biggest bar.
 */
export function BarChart({
  bars,
  goal,
  height = 140,
  selectedKey,
  onPressBar,
  tone = 'steps',
  color,
  name = 'Chart',
  summary,
  describeBar = (b) => `${b.label || b.key}, ${formatSteps(b.value)} steps`,
}: {
  bars: Bar[];
  goal?: number;
  height?: number;
  selectedKey?: string;
  onPressBar?: (key: string) => void;
  tone?: DataTone;
  color?: string;
  /** What the chart shows, for screen readers, e.g. "Steps by hour". */
  name?: string;
  /** One bar for screen readers, with its unit: "1 pm, 2,140 steps". Steps by default. */
  describeBar?: (bar: Bar) => string;
  /** The whole chart in one line, instead of `name` and its biggest bar. */
  summary?: string;
}) {
  const theme = useTheme();
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value));
  const goalY = goal ? height - (goal / max) * height : null;
  const gap = bars.length > 20 ? 2 : 6;
  const fill = color ?? toneColors(theme, tone).fill;

  return (
    <View>
      <View
        style={[styles.plot, { height, gap }]}
        accessible={!onPressBar}
        accessibilityRole={onPressBar ? undefined : 'image'}
        accessibilityLabel={onPressBar ? undefined : (summary ?? chartSummary(name, bars, describeBar))}>
        {goalY !== null ? (
          <View style={[styles.goalLine, { top: goalY, borderColor: theme.onSurfaceVariant }]} pointerEvents="none" />
        ) : null}
        {bars.map((b) => {
          const reached = goal ? b.value >= goal : false;
          const selected = selectedKey === b.key;
          const barColor = selected ? theme.onSurface : reached || !goal ? fill : theme.lane;
          const bar = (
            <View
              style={[
                styles.bar,
                { height: Math.max(b.value > 0 ? 3 : 0, (b.value / max) * height), backgroundColor: barColor },
              ]}
            />
          );
          if (!onPressBar) {
            return (
              <View key={b.key} style={styles.barSlot} accessible={false} importantForAccessibility="no-hide-descendants">
                {bar}
              </View>
            );
          }
          return (
            <Pressable
              key={b.key}
              style={styles.barSlot}
              onPress={() => onPressBar(b.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={describeBar(b)}>
              {bar}
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.labels, { gap }]} importantForAccessibility="no-hide-descendants">
        {/* Labels are wider than a thin bar, so each is centred on its bar and allowed to overhang it. */}
        {bars.map((b) => (
          <View key={b.key} style={styles.labelSlot}>
            {b.label ? (
              <ThemedText type="labelSmall" themeColor="onSurfaceVariant" style={styles.label}>
                {b.label}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: Radius.xs / 2, borderTopRightRadius: Radius.xs / 2 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  labels: { flexDirection: 'row', marginTop: Spacing.one, height: 16 },
  labelSlot: { flex: 1, overflow: 'visible' },
  label: {
    position: 'absolute',
    left: '50%',
    width: LABEL_WIDTH,
    marginLeft: -LABEL_WIDTH / 2,
    textAlign: 'center',
  },
});
