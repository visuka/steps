import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StatTile({
  icon,
  label,
  value,
  note,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  note?: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <View style={styles.head}>
        <Ionicons name={icon} size={16} color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText style={styles.value}>{value}</ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.one },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  value: { fontSize: 24, lineHeight: 30, fontWeight: 700, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, lineHeight: 16 },
});
