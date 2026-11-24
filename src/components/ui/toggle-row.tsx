import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';

/**
 * A Material 3 switch: a white knob on sage when on, and a mid-grey knob on the soft
 * grey lane when off. The off knob (outline #7A7A80, about 4:1 on the white tile) is a
 * mid grey, not a deep solid, and keeps the off switch readable as a control (3:1).
 */
export function MaterialSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (on: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ true: theme.primary, false: theme.lane }}
      thumbColor={value ? theme.onPrimary : theme.outline}
      ios_backgroundColor={theme.lane}
    />
  );
}

/**
 * A list row with a switch at the end. The whole row toggles it, so the
 * target is the full width, not just the switch.
 */
export function ToggleRow({
  title,
  supporting,
  icon,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  /** A short note under the title; it wraps rather than being cut at large text. */
  supporting?: string;
  icon?: IconName;
  value: boolean;
  onValueChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={supporting ? `${title}, ${supporting}` : title}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      android_ripple={{ color: theme.outlineVariant }}
      style={({ pressed }) => [
        styles.row,
        { minHeight: supporting ? 72 : 56 },
        pressed && { backgroundColor: theme.surfaceContainerHighest },
        disabled && { opacity: 0.38 },
      ]}>
      {icon ? <Ionicons name={icon} size={24} color={theme.onSurfaceVariant} /> : null}
      <View style={styles.text}>
        <ThemedText type="bodyLarge">{title}</ThemedText>
        {supporting ? (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            {supporting}
          </ThemedText>
        ) : null}
      </View>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <MaterialSwitch value={value} onValueChange={onValueChange} disabled={disabled} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: { flex: 1, gap: Spacing.half },
});
