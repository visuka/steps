import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Controls, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { BUTTON_STYLE, rippleKind } from './button-style';
import { pressedColor, pressedColorOnAccent } from './surface-style';
import { useToneInk } from './tone-surface';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type ButtonVariant = 'filled' | 'tonal' | 'secondary' | 'outlined' | 'text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** filled: the one main action; tonal: next most; secondary: soft grey fill and ink label (Clean+ "Edit"); outlined and text: the rest. */
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
 * Common button, at least 48 dp tall so it is easy to hit (spec 5.8: 48, radius 16,
 * label 15/22 medium). The theme sets its corners, height and label case
 * (Controls, themes/build.ts). Disabled is a soft grey pill with a readable grey
 * label (BUTTON_STYLE.disabled) and pressed is a ripple only (spec 10.3).
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
  // Words never take colour (rule: colour on surfaces only): sage stays on the filled
  // button's surface, every other label is charcoal ink. A danger action carries its
  // warning on a soft warn surface (a pale pill or a warn edge), not on its letters.
  const look = {
    filled: { bg: danger ? theme.error : theme.primary, fg: danger ? theme.onError : theme.onPrimary, border: undefined },
    tonal: {
      bg: danger ? theme.errorContainer : theme.secondaryContainer,
      fg: danger ? theme.onSurface : theme.onSecondaryContainer,
      border: undefined,
    },
    // A white pill with a hairline: it reads as a button on the grey ground and on a tile.
    secondary: {
      bg: danger ? theme.errorContainer : theme.surfaceBright,
      fg: theme.onSurface,
      border: danger ? undefined : theme.surfaceContainerHigh,
    },
    outlined: { bg: 'transparent', fg: theme.onSurface, border: danger ? theme.error : theme.outline },
    text: { bg: danger ? theme.errorContainer : 'transparent', fg: theme.onSurface, border: undefined },
  }[variant] as { bg: string; fg: string; border: string | undefined };
  // On a tone plate (a filled tile) a tonal button is a ground-coloured pill with the plate's ink,
  // and text and outlined buttons take the ink too.
  if (plate && !danger && (variant === 'tonal' || variant === 'secondary')) Object.assign(look, { bg: plate.lane, fg: plate.ink });
  else if (plate && !danger && variant !== 'filled') Object.assign(look, { fg: plate.ink });
  // Disabled: a soft grey pill (or a grey word) that stays readable, never a faded colour.
  if (off) {
    const d = BUTTON_STYLE.disabled;
    const boxed = variant === 'filled' || variant === 'tonal' || variant === 'secondary' || (variant === 'text' && danger);
    Object.assign(look, {
      bg: boxed ? theme[d.bg] : 'transparent',
      fg: theme[d.fg],
      border: variant === 'outlined' ? theme[d.border] : undefined,
    });
  }
  // A compact text button is a link in the text column: no box, the word on the column's edge.
  const inline = variant === 'text' && compact && !danger;
  const bg = look.bg;
  const fg = look.fg;
  const ripple = rippleKind(variant) === 'onAccent' ? pressedColorOnAccent(look.fg) : pressedColor(theme.onSurface);

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      android_ripple={{ color: ripple, foreground: true }}
      hitSlop={inline ? BUTTON_STYLE.inline.hitSlop : undefined}
      style={[
        styles.button,
        variant === 'text' && (inline ? styles.inline : styles.textButton),
        compact && styles.compact,
        { backgroundColor: bg },
        look.border ? { borderWidth: 1, borderColor: look.border } : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={BUTTON_STYLE.iconSize} color={fg} /> : null}
          <ThemedText
            type="labelLarge"
            maxFontSizeMultiplier={1.3}
            style={[styles.label, Controls.buttonLabel, { color: fg }, variant === 'text' && !danger && styles.underline, inline && styles.inlineLabel]}
            numberOfLines={2}>
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
    paddingHorizontal: BUTTON_STYLE.paddingHorizontal,
    paddingVertical: BUTTON_STYLE.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textButton: { paddingHorizontal: Spacing.three },
  // No box of its own: the 48 dp target comes from the hit slop (BUTTON_STYLE.inline).
  inline: { minHeight: 0, paddingHorizontal: 0, paddingVertical: BUTTON_STYLE.inline.paddingVertical, overflow: 'visible' },
  inlineLabel: { textAlign: 'left' },
  // A charcoal text button is marked as an action by its weight and an underline, not by colour.
  underline: { textDecorationLine: 'underline' },
  compact: { alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: BUTTON_STYLE.iconGap },
  label: { textAlign: 'center', flexShrink: 1 },
  iconTarget: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  iconMark: { width: 40, height: 40, ...Controls.iconMark, alignItems: 'center', justifyContent: 'center' },
});
