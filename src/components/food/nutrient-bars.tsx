import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatNutrient, NUTRIENTS, percentOfDaily } from '@/nutrition/nutrients';
import type { NutrientInfo } from '@/nutrition/nutrients';
import type { Nutrients } from '@/nutrition/types';

/** Amount and share of the daily value for each nutrient in `groups` that has data. */
export function NutrientBars({ nutrients, groups }: { nutrients: Nutrients; groups: NutrientInfo['group'][] }) {
  const theme = useTheme();
  const rows = NUTRIENTS.filter((n) => groups.includes(n.group) && nutrients[n.key] !== undefined);
  return (
    <View style={styles.list}>
      {rows.map((n) => {
        const value = nutrients[n.key]!;
        const pct = percentOfDaily(n.key, value);
        return (
          <View key={n.key} style={styles.row}>
            <ThemedText type="small" style={styles.label}>
              {n.label}
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.track }]}>
              <View
                style={[styles.fill, { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? theme.accent : theme.text }]}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
              {formatNutrient(n.key, value)} · {pct}%
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { width: 92 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, opacity: 0.85 },
  value: { width: 112, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
