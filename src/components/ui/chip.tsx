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
        // Unselected chips sit on the ground #ECECEE (docs/design.md), with a hairline so they read on the
        // grey ground too. The edge is always 1 dp (clear when selected), so choosing a chip never shifts the row.
        { backgroundColor: on ? theme.secondaryContainer : theme.surfaceContainer, borderColor: on ? 'transparent' : theme.surfaceContainerHigh },
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
        // Short labels never shrink (a shrunk box dropped the "y" of "Today" onto a hidden line);
        // only a long name (a club) may wrap inside the chip, which the chip's maxWidth keeps in the row.
        style={[Controls.chipLabel, styles.label, label.length > LONG_LABEL && styles.shrink, { color: on ? fg : theme.onSurface }]}>
        {label}
      </ThemedText>
      {trailingIcon ? <SpecIcon name={trailingIcon} color={theme.onSurfaceVariant} /> : null}
    </Pressable>
  );
}

/** The chip's hairline edge (always drawn, clear when selected). */
const CHIP_EDGE = 1;
const LABEL_SLACK = 1;
/** Labels longer than this (club names) may wrap inside the chip. */
const LONG_LABEL = 22;

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_STYLE.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_STYLE.gap,
    borderRadius: CHIP_STYLE.radius,
    borderWidth: CHIP_EDGE,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  // 1 dp of end slack, so a rounding difference cannot push the last word onto a hidden line.
  label: { paddingEnd: LABEL_SLACK },
  shrink: { flexShrink: 1 },
  // The edge and the slack come out of the padding, so a chip keeps its spec width (rows still fit at 360 dp).
  plain: { paddingLeft: CHIP_STYLE.paddingLeft - CHIP_EDGE, paddingRight: CHIP_STYLE.paddingRightPlain - CHIP_EDGE - LABEL_SLACK },
  withTrailing: {
    paddingLeft: CHIP_STYLE.paddingLeft - CHIP_EDGE,
    paddingRight: CHIP_STYLE.paddingRight - CHIP_EDGE,
    gap: CHIP_STYLE.gapTrailing - LABEL_SLACK,
  },
  dot: { width: CHIP_STYLE.dotSize, height: CHIP_STYLE.dotSize, borderRadius: CHIP_STYLE.dotRadius },
});
