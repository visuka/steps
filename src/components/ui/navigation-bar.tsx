import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { type DataTone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { SpecIcon, type SpecIconName } from './icons';
import { NAV, SLOT_VISUAL_HEIGHT, barHeight, fabTopInWrapper, slotTouch, wrapperHeight } from './nav-style';
import { pressedColorOnAccent } from './surface-style';

export interface NavigationItem {
  key: string;
  /** Spoken by TalkBack; the bar shows no text. */
  label: string;
  /** Outline icon (Ionicons) for existing callers. */
  icon?: IconName;
  /** Selected icon (Ionicons) for existing callers: selection is also shown by colour and the dot. */
  activeIcon?: IconName;
  /** A Clean+ icon; wins over `icon` / `activeIcon` when given. */
  specIcon?: SpecIconName;
  /** Kept for existing callers; the Clean+ bar paints every selection in primary. */
  tone?: DataTone;
  /** The middle "Log food" button: a 56 dp primary circle with a plus, lifted above the bar. */
  fab?: boolean;
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
 * The Clean+ bottom bar (spec 5.7): 72 dp plus the system inset, white with a
 * hairline above, icons only with a dot under the selected one. Each slot is
 * 48 wide and has a touch area of at least 48 x 48; the labels are spoken only.
 */
export function NavigationBar({ items, activeKey, onSelect, onReselect, bottomInset }: NavigationBarProps) {
  const theme = useTheme();
  const fabItem = items.find((item) => item.fab);
  return (
    // Transparent wrapper: the lifted FAB must lie inside a parent for Android to deliver its touches.
    // box-none lets the empty overhang pass touches to what is behind.
    <View pointerEvents="box-none" style={{ height: wrapperHeight(bottomInset) }}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.outlineVariant,
            height: barHeight(bottomInset),
            paddingBottom: bottomInset,
          },
        ]}>
        {items.map((item) =>
          item.fab ? (
            <View key={item.key} style={styles.slotFrame} />
          ) : (
            <Destination
              key={item.key}
              item={item}
              active={item.key === activeKey}
              onPress={() => (item.key === activeKey ? onReselect?.(item.key) : onSelect(item.key))}
            />
          ),
        )}
      </View>
      {fabItem ? (
        <View pointerEvents="box-none" style={[styles.fabRow, { top: fabTopInWrapper(bottomInset) }]}>
          <Pressable
            onPress={() => (fabItem.key === activeKey ? onReselect?.(fabItem.key) : onSelect(fabItem.key))}
            accessibilityRole="button"
            accessibilityLabel={fabItem.label}
            android_ripple={{ color: pressedColorOnAccent(theme.onPrimary), foreground: true }}
            style={[styles.fab, { backgroundColor: theme.primary, boxShadow: NAV.fabShadow }]}>
            <SpecIcon name={fabItem.specIcon ?? 'plus'} color={theme.onPrimary} size={NAV.fabIconSize} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Destination({ item, active, onPress }: { item: NavigationItem; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = active ? theme.primary : theme.onSurfaceVariant;
  const ionicon = active ? (item.activeIcon ?? item.icon) : item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={styles.touch}>
      <View style={styles.visual}>
        {item.specIcon ? (
          <SpecIcon name={item.specIcon} color={color} size={NAV.iconSize} />
        ) : ionicon ? (
          <Ionicons name={ionicon} size={NAV.iconSize} color={color} />
        ) : null}
        <View style={[styles.dot, { backgroundColor: active ? theme.primary : 'transparent' }]} />
      </View>
    </Pressable>
  );
}

const touch = slotTouch();

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: NAV.sidePadding,
    borderTopWidth: NAV.hairline,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  // The touch area is larger than the drawn slot; the pictures do not change.
  touch: { width: touch.width, height: touch.height, alignItems: 'center', justifyContent: 'center' },
  visual: { width: NAV.slotWidth, height: SLOT_VISUAL_HEIGHT, alignItems: 'center', gap: NAV.iconDotGap },
  dot: { width: NAV.dot, height: NAV.dot, borderRadius: NAV.dotRadius },
  slotFrame: { width: NAV.slotWidth, height: touch.height },
  // Full-width row at the wrapper's top; the FAB is centred in it.
  fabRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: {
    width: NAV.fab,
    height: NAV.fab,
    borderRadius: NAV.fabRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
