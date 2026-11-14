import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Controls, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useToneInk } from './tone-surface';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** filled: the one main action; tonal: next most; outlined and text: the rest. */
  variant?: ButtonVariant;
  /** Destructive actions (delete) use the error colour. */
  danger?: boolean;
  icon?: IconName;
  disabled?: boolean;
  /** Shows a spinner and ignores taps. */
  loading?: boolean;
  /** Hug the label instead of filling the row. */
  compact?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Material 3 common button, at least 48 dp tall so it is easy to hit. The
 * theme sets its corners, height and label case (Controls, themes/build.ts).
 */
export function Button({
  label,
  onPress,
  variant = 'filled',
  danger,
  icon,
  disabled,
  loading,
  compact,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const plate = useToneInk();
  const off = disabled || loading;
  const look = {
    filled: { bg: danger ? theme.error : theme.primary, fg: danger ? theme.onError : theme.onPrimary, border: undefined },
    tonal: {
      bg: danger ? theme.errorContainer : theme.secondaryContainer,
      fg: danger ? theme.onErrorContainer : theme.onSecondaryContainer,
      border: undefined,
    },
    outlined: { bg: 'transparent', fg: danger ? theme.error : theme.primary, border: theme.outline },
    text: { bg: 'transparent', fg: danger ? theme.error : theme.primary, border: undefined },
  }[variant];
  // On a tone plate (a filled tile) a tonal button is a ground-coloured pill with the plate's ink,
  // and text and outlined buttons take the ink too.
  if (plate && !danger && variant === 'tonal') Object.assign(look, { bg: plate.lane, fg: plate.ink });
  else if (plate && !danger && variant !== 'filled') Object.assign(look, { fg: plate.ink });
  // Disabled, per Material: on-surface at 12% behind, 38% for the label.
  const bg = off && variant !== 'text' && variant !== 'outlined' ? `${theme.onSurface}1F` : look.bg;
  const fg = off ? `${theme.onSurface}61` : look.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      android_ripple={{ color: `${look.fg}29`, foreground: true }}
      style={({ pressed }) => [
        styles.button,
        variant === 'text' && styles.textButton,
        compact && styles.compact,
        { backgroundColor: bg },
        look.border ? { borderWidth: 1, borderColor: off ? `${theme.onSurface}1F` : look.border } : null,
        pressed && { opacity: 0.88 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <ThemedText type="labelLarge" style={[styles.label, Controls.buttonLabel, { color: fg }]} numberOfLines={2}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/** Material 3 icon button: a 40 dp mark inside a 48 dp target. Always give it a label. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'standard',
  disabled,
  color,
  size = 24,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'standard' | 'tonal' | 'filled';
  disabled?: boolean;
  /** Icon colour for the standard variant; defaults to onSurfaceVariant. */
  color?: string;
  size?: number;
}) {
  const theme = useTheme();
  const bg = variant === 'filled' ? theme.primary : variant === 'tonal' ? theme.secondaryContainer : 'transparent';
  const fg =
    variant === 'filled' ? theme.onPrimary : variant === 'tonal' ? theme.onSecondaryContainer : (color ?? theme.onSurfaceVariant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.iconTarget, { opacity: disabled ? 0.38 : pressed ? 0.7 : 1 }]}>
      <View style={[styles.iconMark, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={size} color={fg} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    ...Controls.button,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textButton: { paddingHorizontal: Spacing.three },
  compact: { alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { textAlign: 'center', flexShrink: 1 },
  iconTarget: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  iconMark: { width: 40, height: 40, ...Controls.iconMark, alignItems: 'center', justifyContent: 'center' },
});
