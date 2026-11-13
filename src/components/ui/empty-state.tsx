import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button, type IconName } from './button';

/** Nothing here yet: an icon, a short title, one line of hint, and the action that fills it. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: IconName;
  title: string;
  /** One line at most. */
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, { backgroundColor: theme.surfaceContainerHigh }]}>
        <Ionicons name={icon} size={32} color={theme.onSurfaceVariant} />
      </View>
      <ThemedText type="titleMedium" style={styles.center}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.center}>
          {hint}
        </ThemedText>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="tonal" compact style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  mark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  center: { textAlign: 'center' },
  action: { alignSelf: 'center', marginTop: Spacing.two },
});
