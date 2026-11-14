import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Controls, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';

/**
 * Material 3 extended FAB: the one primary action of a screen, 56 dp tall,
 * in the ink colour so it is found at a glance outdoors. One per screen.
 * Pass it to <Screen fab={…} />, which places it above the navigation bar.
 */
export function ExtendedFab({
  label,
  icon,
  onPress,
  accessibilityHint,
  style,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: `${theme.onPrimary}29`, foreground: true }}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: theme.primary, shadowColor: theme.shadow },
        pressed && { opacity: 0.92 },
        style,
      ]}>
      <Ionicons name={icon} size={24} color={theme.onPrimary} />
      <ThemedText type="labelLarge" style={[Controls.buttonLabel, { color: theme.onPrimary }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    minHeight: 56,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.four - 4,
    overflow: 'hidden',
    // Corners and the level 3 shadow (the only shadow in the app) come from the theme.
    ...Controls.fab,
  },
});
