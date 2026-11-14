import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { clampShare, NUTRIENT_STYLE as S, nutrientLabel } from './nutrient-style';
import { Pill } from './pill';

/** The 4 dp bar: lane track, filled by `share` (0 to 1) in `color` (default primary). Also for the Food tile. */
export function BarTrack({ share, color }: { share: number; color?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.lane }]}>
      <View style={[styles.fill, { width: `${clampShare(share) * 100}%`, backgroundColor: color ?? theme.primary }]} />
    </View>
  );
}

export interface NutrientRowProps {
  name: string;
  /** Already formatted, e.g. '≥ 1,850 mg'. */
  value: string;
  /** Share of daily need, 0 to 1 (over is a full bar). */
  share: number;
  /** A limit the app already flags: warn colours (fill only; the track stays lane). */
  warn?: boolean;
  /** Show the 'High' pill after the name (use with warn). */
  pill?: boolean;
}

/** One nutrient: name (140), bar (flex), value (88, right). Spec 5.10. */
export function NutrientRow({ name, value, share, warn, pill }: NutrientRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={nutrientLabel(name, value, share, warn)}>
      <View style={styles.name}>
        <ThemedText type="bodyMedium" maxFontSizeMultiplier={1.3} style={[styles.nameText, { color: warn ? theme.error : theme.onSurface }]}>
          {name}
        </ThemedText>
        {pill ? <Pill label="High" variant="warning" /> : null}
      </View>
      <View style={styles.bar}>
        <BarTrack share={share} color={warn ? theme.error : undefined} />
      </View>
      <ThemedText type="bodyMedium" maxFontSizeMultiplier={1.3} style={[styles.value, { color: warn ? theme.error : theme.onSurfaceVariant }]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: S.minHeight, flexDirection: 'row', alignItems: 'center', gap: S.gap },
  name: { width: S.nameWidth, flexDirection: 'row', alignItems: 'center', gap: S.pillGap },
  nameText: { flexShrink: 1 },
  bar: { flex: 1 },
  track: { height: S.barHeight, borderRadius: S.barRadius, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: S.barRadius },
  value: { width: S.valueWidth, textAlign: 'right' },
});
