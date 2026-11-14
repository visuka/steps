import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { type DataTone, Look, Motion, NavigationBarHeight, Radius, Spacing, toneColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { standardTiming } from './motion';

export interface NavigationItem {
  key: string;
  label: string;
  /** Outline icon, shown when the destination is not selected. */
  icon: IconName;
  /** Filled icon, shown when it is: the second cue besides the pill. */
  activeIcon: IconName;
  /** The area's data colour; themes with a 'tone' indicator paint the pill in its container. */
  tone?: DataTone;
}

export interface NavigationBarProps {
  items: NavigationItem[];
  /** The selected destination; null when the screen belongs to none. */
  activeKey: string | null;
  onSelect: (key: string) => void;
  onReselect?: (key: string) => void;
  /** The gesture or 3-button bar below, so the bar draws edge to edge. */
  bottomInset: number;
}

/**
 * Material 3 navigation bar: 3 to 5 destinations, icon and label always
 * shown, the selected one in a 64 × 32 dp pill. 80 dp tall plus the
 * system bar inset; the bar grows with large text instead of clipping.
 */
export function NavigationBar({ items, activeKey, onSelect, onReselect, bottomInset }: NavigationBarProps) {
  const theme = useTheme();
  // Plain themes sit the bar on a tonal plate; the others on the ground with a hairline above.
  const ground =
    Look.tile === 'plain'
      ? { backgroundColor: theme.surfaceContainer }
      : { backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.outlineVariant };
  return (
    <View accessibilityRole="tablist" style={[styles.bar, ground, { paddingBottom: bottomInset }]}>
      {items.map((item) => (
        <Destination
          key={item.key}
          item={item}
          active={item.key === activeKey}
          onPress={() => (item.key === activeKey ? onReselect?.(item.key) : onSelect(item.key))}
        />
      ))}
    </View>
  );
}

function Destination({ item, active, onPress }: { item: NavigationItem; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const grow = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    grow.value = withTiming(active ? 1 : 0, standardTiming(Motion.duration.short));
  }, [active, grow]);
  // The pill opens from the middle, Material's own indicator motion; a cut with reduce motion.
  const pill = useAnimatedStyle(() => ({ opacity: grow.value, transform: [{ scaleX: 0.5 + grow.value / 2 }] }));
  const toned = Look.navIndicator === 'tone' && item.tone ? toneColors(theme, item.tone) : null;
  const pillColor = toned ? toned.container : theme.secondaryContainer;
  const onPill = toned ? toned.onContainer : theme.onSecondaryContainer;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={styles.item}>
      <View style={styles.iconSlot}>
        <Animated.View style={[styles.pill, { backgroundColor: pillColor }, pill]} />
        <Ionicons name={active ? item.activeIcon : item.icon} size={24} color={active ? onPill : theme.onSurfaceVariant} />
      </View>
      <ThemedText
        type="labelMedium"
        themeColor={active ? 'onSurface' : 'onSurfaceVariant'}
        maxFontSizeMultiplier={1.5}
        numberOfLines={1}
        style={[styles.label, active && styles.labelActive]}>
        {item.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: NavigationBarHeight },
  item: {
    flex: 1,
    minHeight: NavigationBarHeight,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.three - 4,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  iconSlot: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { ...StyleSheet.absoluteFill, borderRadius: Radius.full },
  label: { textAlign: 'center', paddingHorizontal: Spacing.half },
  labelActive: { fontWeight: '700' },
});
