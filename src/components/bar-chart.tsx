import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';

const LABEL_WIDTH = 40;

export interface Bar {
  key: string;
  value: number;
  /** Axis label; empty string to skip. */
  label: string;
}

/**
 * Plain-View bars: light enough for 24 hourly bars or 31 daily ones. Bars at
 * or over `goal` use the accent colour; a dashed line marks the goal.
 */
export function BarChart({
  bars,
  goal,
  height = 140,
  selectedKey,
  onPressBar,
}: {
  bars: Bar[];
  goal?: number;
  height?: number;
  selectedKey?: string;
  onPressBar?: (key: string) => void;
}) {
  const theme = useTheme();
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value));
  const goalY = goal ? height - (goal / max) * height : null;
  const gap = bars.length > 20 ? 2 : 6;

  return (
    <View>
      <View style={[styles.plot, { height, gap }]}>
        {goalY !== null ? (
          <View style={[styles.goalLine, { top: goalY, borderColor: theme.textSecondary }]} pointerEvents="none" />
        ) : null}
        {bars.map((b) => {
          const reached = goal ? b.value >= goal : false;
          const selected = selectedKey === b.key;
          const color = selected ? theme.text : reached || !goal ? theme.accent : theme.track;
          return (
            <Pressable
              key={b.key}
              style={styles.barSlot}
              disabled={!onPressBar}
              onPress={() => onPressBar?.(b.key)}
              accessibilityLabel={`${b.label || b.key}: ${formatSteps(b.value)}`}>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(b.value > 0 ? 3 : 0, (b.value / max) * height), backgroundColor: color },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.labels, { gap }]}>
        {/* Labels are wider than a thin bar, so each is centred on its bar and allowed to overhang it. */}
        {bars.map((b) => (
          <View key={b.key} style={styles.labelSlot}>
            {b.label ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
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
  bar: { width: '100%', borderRadius: 3 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  labels: { flexDirection: 'row', marginTop: Spacing.one, height: 16 },
  labelSlot: { flex: 1, overflow: 'visible' },
  label: {
    position: 'absolute',
    left: '50%',
    width: LABEL_WIDTH,
    marginLeft: -LABEL_WIDTH / 2,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
