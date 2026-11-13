import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';

export interface ChipProps {
  label: string;
  onPress: () => void;
  /** A filter chip: shows a tick when selected. Leave undefined for an assist chip. */
  selected?: boolean;
  /** Leading icon (assist chips). */
  icon?: IconName;
  /** A small data-colour dot before the label, e.g. theme.near for "High in salt". Never the only signal. */
  dot?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Material 3 chip: 32 dp to see, 48 dp to hit. */
export function Chip({ label, onPress, selected, icon, dot, disabled, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const on = selected === true;
  const fg = on ? theme.onSecondaryContainer : theme.onSurfaceVariant;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? { disabled: !!disabled } : { selected: on, disabled: !!disabled }}
      aria-selected={selected === undefined ? undefined : on}
      style={({ pressed }) => [
        styles.chip,
        on
          ? { backgroundColor: theme.secondaryContainer, borderColor: theme.secondaryContainer }
          : { backgroundColor: theme.surface, borderColor: theme.outlineVariant },
        pressed && { backgroundColor: theme.surfaceContainerHighest },
        disabled && { opacity: 0.38 },
      ]}>
      {on ? <Ionicons name="checkmark" size={18} color={fg} /> : icon ? <Ionicons name={icon} size={18} color={theme.primary} /> : null}
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <ThemedText type="labelLarge" style={{ color: on ? fg : theme.onSurface }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
