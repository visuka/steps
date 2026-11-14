import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { type DataTone, Look, Motion, NumeralMaxScale, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { standardTiming } from './motion';
import { tileColors } from './tile-colors';
import { toneInk, ToneInkContext } from './tone-surface';

export interface StatTileProps {
  /** One or two words: "Food", "Water". */
  label: string;
  /** The number, already formatted. Use "—" for unknown, never 0. */
  value: string;
  /** Small, after the number: "kcal", "min". */
  unit?: string;
  icon?: IconName;
  /** One short line under the number, e.g. "Estimated". */
  note?: string;
  /** Tapping opens its detail in place. */
  onPress?: () => void;
  /** This tile's detail is open. */
  selected?: boolean;
  /** Another tile's detail is open: this one recedes. */
  dimmed?: boolean;
  /** What the number is about. With the theme's 'filled' tiles the tile is painted in its container colour. */
  tone?: DataTone;
  /** Under the number: a TickBar, a +1 button. */
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A number with its label, on a plate. In a row they share the width. The
 * theme's `tile` style picks the plate: its tone's container (filled), an
 * outlined card, or a tonal surface (plain).
 */
export function StatTile({
  label,
  value,
  unit,
  icon,
  note,
  onPress,
  selected,
  dimmed,
  tone,
  children,
  accessibilityLabel,
  accessibilityHint,
  style,
}: StatTileProps) {
  const theme = useTheme();
  const fade = useSharedValue(dimmed ? 0.4 : 1);
  useEffect(() => {
    fade.value = withTiming(dimmed ? 0.4 : 1, standardTiming(Motion.duration.short));
  }, [dimmed, fade]);
  const faded = useAnimatedStyle(() => ({ opacity: fade.value }));

  const ink = tone && Look.tile === 'filled' ? toneInk(theme, tone) : null;
  // Text takes the colours of the plate it is on (a selected tile is secondaryContainer).
  const look = tileColors(theme, Look.tile, tone, !!selected);
  const quiet = { color: look.quiet };

  const head = (
    <>
      <View style={styles.head}>
        {icon ? <Ionicons name={icon} size={16} color={look.quiet} /> : null}
        <ThemedText type="labelMedium" style={[styles.label, quiet]} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.valueRow}>
        <ThemedText
          type="numeralMedium"
          style={{ color: look.text }}
          maxFontSizeMultiplier={NumeralMaxScale}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText type="labelMedium" style={quiet}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      {note ? (
        <ThemedText type="bodySmall" style={quiet} numberOfLines={2}>
          {note}
        </ThemedText>
      ) : null}
    </>
  );

  // Selected: a filled tile keeps its colour and gains a 2 dp ink edge; the others turn secondaryContainer.
  const plate: ViewStyle = { backgroundColor: look.plate, borderWidth: look.borderWidth, borderColor: look.border };
  const tile = (
    <Animated.View style={[styles.tile, plate, ink && styles.roomy, faded, style]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${label}, ${value}${unit ? ` ${unit}` : ''}`}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ expanded: !!selected }}
          style={[styles.press, !children && styles.pressAlone]}>
          {head}
        </Pressable>
      ) : (
        <View style={[styles.press, !children && styles.pressAlone]} accessible accessibilityLabel={accessibilityLabel}>
          {head}
        </View>
      )}
      {children ? <View style={styles.extra}>{children}</View> : null}
    </Animated.View>
  );
  return ink ? <ToneInkContext value={ink}>{tile}</ToneInkContext> : tile;
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: Radius.md, overflow: 'hidden' },
  press: { paddingHorizontal: Spacing.three - 4, paddingTop: Spacing.three - 4, gap: Spacing.one, flexGrow: 1 },
  pressAlone: { paddingBottom: Spacing.three - 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  label: { flexShrink: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: Spacing.one },
  extra: { paddingHorizontal: Spacing.three - 4, paddingTop: Spacing.two, paddingBottom: Spacing.three - 4 },
  // A filled tile's 2 dp edge (clear until selected) plus 2 dp more: 16 dp inside, as the blocks are drawn.
  roomy: { padding: Spacing.half },
});
