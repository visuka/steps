import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Motion, NumeralMaxScale, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { standardTiming } from './motion';

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
  /** Under the number: a TickBar, a +1 button. */
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** A number with its label, on a tonal plate. In a row they share the width. */
export function StatTile({
  label,
  value,
  unit,
  icon,
  note,
  onPress,
  selected,
  dimmed,
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

  const head = (
    <>
      <View style={styles.head}>
        {icon ? <Ionicons name={icon} size={16} color={selected ? theme.onSecondaryContainer : theme.onSurfaceVariant} /> : null}
        <ThemedText
          type="labelMedium"
          themeColor={selected ? 'onSecondaryContainer' : 'onSurfaceVariant'}
          style={styles.label}
          numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.valueRow}>
        <ThemedText type="numeralMedium" maxFontSizeMultiplier={NumeralMaxScale} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText type="labelMedium" themeColor="onSurfaceVariant">
            {unit}
          </ThemedText>
        ) : null}
      </View>
      {note ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" numberOfLines={2}>
          {note}
        </ThemedText>
      ) : null}
    </>
  );

  const plate = { backgroundColor: selected ? theme.secondaryContainer : theme.surfaceContainer };
  return (
    <Animated.View style={[styles.tile, plate, faded, style]}>
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
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: Radius.md, overflow: 'hidden' },
  press: { paddingHorizontal: Spacing.three - 4, paddingTop: Spacing.three - 4, gap: Spacing.one, flexGrow: 1 },
  pressAlone: { paddingBottom: Spacing.three - 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  label: { flexShrink: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: Spacing.one },
  extra: { paddingHorizontal: Spacing.three - 4, paddingTop: Spacing.two, paddingBottom: Spacing.three - 4 },
});
