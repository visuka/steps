import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Controls } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { CHIP_STYLE, chipHitSlopVertical } from './chip-style';
import { SpecIcon } from './icons';
import { pressedColor } from './surface-style';

export interface ChipProps {
  label: string;
  onPress: () => void;
  /** A filter chip: shows a tick when selected. Leave undefined for an assist chip. */
  selected?: boolean;
  /** Leading icon (assist chips). */
  icon?: IconName;
  /** A small data-colour dot before the label, e.g. theme.near for "High in salt". Never the only signal. */
  dot?: string;
  /** A chevron after the label for a chip that opens a choice ("1 bowl"): padding becomes 0 12 0 16. */
  trailingIcon?: 'chevron-down';
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Clean+ chip: 40 dp to see (20 dp corners, soft fill; selected = accentMid), 48 dp to hit. */
export function Chip({ label, onPress, selected, icon, dot, trailingIcon, disabled, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const on = selected === true;
  const fg = on ? theme.onSecondaryContainer : theme.onSurfaceVariant;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: chipHitSlopVertical(), bottom: chipHitSlopVertical() }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected === undefined ? { disabled: !!disabled } : { selected: on, disabled: !!disabled }}
      aria-selected={selected === undefined ? undefined : on}
      // Pressed is a ripple only, ink at 8 % (spec 10.3).
      android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
      style={[
        styles.chip,
        trailingIcon ? styles.withTrailing : styles.plain,
        { backgroundColor: on ? theme.secondaryContainer : theme.surfaceContainer },
        disabled && { opacity: 0.38 },
      ]}>
      {on ? (
        <Ionicons name="checkmark" size={CHIP_STYLE.iconSize} color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={CHIP_STYLE.iconSize} color={theme.primary} />
      ) : null}
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <ThemedText
        type={Controls.chipType === 'labelLarge' ? 'bodyMedium' : Controls.chipType}
        maxFontSizeMultiplier={1.3}
        style={[Controls.chipLabel, { color: on ? fg : theme.onSurface }]}>
        {label}
      </ThemedText>
      {trailingIcon ? <SpecIcon name={trailingIcon} color={theme.onSurfaceVariant} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_STYLE.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_STYLE.gap,
    borderRadius: CHIP_STYLE.radius,
    overflow: 'hidden',
  },
  plain: { paddingLeft: CHIP_STYLE.paddingLeft, paddingRight: CHIP_STYLE.paddingRightPlain },
  withTrailing: { paddingLeft: CHIP_STYLE.paddingLeft, paddingRight: CHIP_STYLE.paddingRight, gap: CHIP_STYLE.gapTrailing },
  dot: { width: CHIP_STYLE.dotSize, height: CHIP_STYLE.dotSize, borderRadius: CHIP_STYLE.dotRadius },
});
