import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import type { DataTone } from '@/constants/theme';
import { Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { standardTiming } from './motion';
import { pressedColor } from './surface-style';
import {
  TILE_STYLE,
  tileAccessibilityLabel,
  tileBottomPadding,
  type TileValueStyle,
  valueIsMuted,
  valueTypeRole,
  valueWithUnit,
} from './stat-tile-style';
import { tileColors } from './tile-colors';

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
  /** What the number is about. Accepted for callers; the Clean+ tile is white in every look, so it paints nothing. */
  tone?: DataTone;
  /** 'muted' draws the value as quiet body text (a missing value such as "No walk yet"); 'mutedValue' keeps the value size in the muted colour. */
  valueStyle?: TileValueStyle;
  /** Under the number: a TickBar, a +1 button. */
  children?: ReactNode;
  /** Clean+: replaces the icon circle at the left of the header row (an IconCircle). */
  iconCircle?: ReactNode;
  /** Clean+: the right of the header row: a chevron, a plus circle, a pill. */
  trailing?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A number with its label on a white card with the card shadow, laid out as
 * spec 5.5 in every look (looks differ only in colours and fonts): a 40 dp
 * header row, the label, the value with its unit nested inline, then the bar.
 * In a row the tiles share the width. The 146 dp height is a minimum.
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
  valueStyle = 'default',
  children,
  iconCircle,
  trailing,
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

  // Text takes the colours of the plate it is on (a selected tile is secondaryContainer).
  const look = tileColors(theme, 'plain', undefined, !!selected);
  const quiet = { color: look.quiet };

  const parts = valueWithUnit(value, unit);
  const faceColor = valueIsMuted(valueStyle) ? look.quiet : look.text;
  const inner = (
    <>
      <View style={styles.cleanHeader}>
        {iconCircle ??
          (icon ? (
            <View style={[styles.circle, { backgroundColor: theme.primaryContainer }]}>
              <Ionicons name={icon} size={CLEAN_SPEC.icon.size} color={theme.primary} />
            </View>
          ) : (
            <View />
          ))}
        {trailing}
      </View>
      <ThemedText type="bodySmall" style={[styles.cleanLabel, quiet]} maxFontSizeMultiplier={1.3}>
        {label}
      </ThemedText>
      <ThemedText type={valueTypeRole(valueStyle)} style={{ color: faceColor }} maxFontSizeMultiplier={1.3}>
        {parts.value}
        {parts.unit ? (
          <ThemedText type="bodySmall" style={quiet} maxFontSizeMultiplier={1.3}>
            {parts.unit}
          </ThemedText>
        ) : null}
      </ThemedText>
      {note ? (
        <ThemedText type="bodySmall" style={[styles.cleanNote, quiet]} maxFontSizeMultiplier={1.3}>
          {note}
        </ThemedText>
      ) : null}
      {children ? <View style={styles.cleanExtra}>{children}</View> : null}
    </>
  );
  const bottomPad = { paddingBottom: tileBottomPadding(!!note, !!children) };
  const shape: ViewStyle = {
    backgroundColor: selected ? look.plate : theme.surfaceContainerLowest,
    boxShadow: TILE_STYLE.boxShadow,
  };
  return (
    <Animated.View style={[styles.cleanTile, shape, faded, style]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? tileAccessibilityLabel(label, value, unit)}
          accessibilityHint={accessibilityHint}
          accessibilityState={selected === undefined ? undefined : { expanded: selected }}
          android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
          style={[styles.cleanPress, bottomPad]}>
          {inner}
        </Pressable>
      ) : (
        <View style={[styles.cleanPress, bottomPad]} accessible accessibilityLabel={accessibilityLabel ?? tileAccessibilityLabel(label, value, unit, note)}>
          {inner}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Clean+ (spec 5.5): the shadow sits on this layer, so the clip is on the inner one.
  cleanTile: { flexGrow: 1, flexBasis: '45%', borderRadius: TILE_STYLE.radius },
  cleanPress: {
    flexGrow: 1,
    minHeight: TILE_STYLE.minHeight,
    padding: TILE_STYLE.padding,
    borderRadius: TILE_STYLE.radius,
    overflow: 'hidden',
  },
  cleanHeader: { minHeight: TILE_STYLE.headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circle: {
    width: TILE_STYLE.headerHeight,
    height: TILE_STYLE.headerHeight,
    borderRadius: TILE_STYLE.circleRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanLabel: { marginTop: TILE_STYLE.labelGap },
  cleanNote: { marginTop: TILE_STYLE.noteGap },
  cleanExtra: { marginTop: TILE_STYLE.extraGap },
});
