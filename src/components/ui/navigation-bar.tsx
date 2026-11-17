import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DataTone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { SpecIcon, type SpecIconName } from './icons';
import { NAV, SLOT_VISUAL_HEIGHT, barHeight, slotTouch } from './nav-style';

export interface NavigationItem {
  key: string;
  /** Shown under the icon. */
  label: string;
  /** What TalkBack says; the label when missing. */
  spoken?: string;
  /** Outline icon (Ionicons) for existing callers. */
  icon?: IconName;
  /** Selected icon (Ionicons) for existing callers. */
  activeIcon?: IconName;
  /** A Clean+ icon; wins over `icon` / `activeIcon` when given. */
  specIcon?: SpecIconName;
  /** Kept for existing callers; the bar paints every selection in one colour. */
  tone?: DataTone;
}

/** The bar's colours. Today passes its day palette; other screens use the theme. */
export interface NavigationBarColors {
  fill: string;
  hairline: string;
  /** The selected icon and its circle. */
  active: string;
  activeFill?: string;
  /** The other icons and their circles. */
  idle: string;
  idleFill?: string;
}

export interface NavigationBarProps {
  items: NavigationItem[];
  /** The selected destination; null when the screen belongs to none. */
  activeKey: string | null;
  onSelect: (key: string) => void;
  onReselect?: (key: string) => void;
  /** The gesture or 3-button bar below, so the bar draws edge to edge. */
  bottomInset: number;
  colors?: NavigationBarColors;
}

/**
 * The bottom bar (docs/design.md "Bottom bar", owner 17 Nov 2026): 64 dp plus
 * the system inset, on the screen's ground, a row of 48 dp round buttons 16
 * apart. The selected one is a near-white circle with a black icon, the
 * others grey circles with grey icons. Labels are not drawn; TalkBack says them.
 */
export function NavigationBar({ items, activeKey, onSelect, onReselect, bottomInset, colors }: NavigationBarProps) {
  const theme = useTheme();
  const c: NavigationBarColors = colors ?? {
    fill: theme.background,
    hairline: theme.background,
    active: theme.onSurface,
    activeFill: theme.surfaceContainerLowest,
    idle: theme.onSurfaceVariant,
    idleFill: theme.surfaceContainerHigh,
  };
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: c.fill,
          borderTopColor: c.hairline,
          height: barHeight(bottomInset),
          paddingBottom: bottomInset,
        },
      ]}>
      {items.map((item) => (
        <Destination
          key={item.key}
          item={item}
          active={item.key === activeKey}
          color={item.key === activeKey ? c.active : c.idle}
          fill={(item.key === activeKey ? c.activeFill : c.idleFill) ?? theme.surfaceContainerHigh}
          onPress={() => (item.key === activeKey ? onReselect?.(item.key) : onSelect(item.key))}
        />
      ))}
    </View>
  );
}

function Destination({ item, active, color, fill, onPress }: { item: NavigationItem; active: boolean; color: string; fill: string; onPress: () => void }) {
  const ionicon = active ? (item.activeIcon ?? item.icon) : item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={item.spoken ?? item.label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      android_ripple={{ color: `${color}1F`, borderless: true, radius: NAV.slotWidth / 2 }}
      style={styles.touch}>
      <View style={[styles.visual, { backgroundColor: fill }]}>
        {item.specIcon ? (
          <SpecIcon name={item.specIcon} color={color} size={NAV.iconSize} />
        ) : ionicon ? (
          <Ionicons name={ionicon} size={NAV.iconSize} color={color} />
        ) : null}
      </View>
    </Pressable>
  );
}

const touch = slotTouch();

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NAV.slotGap,
    paddingHorizontal: NAV.sidePadding,
    borderTopWidth: NAV.hairline,
  },
  // The touch area is at least 48 x 48; the drawn slot sits in its middle.
  touch: { width: touch.width, minHeight: touch.height, alignItems: 'center', justifyContent: 'center' },
  visual: { width: NAV.slotWidth, height: SLOT_VISUAL_HEIGHT, borderRadius: NAV.slotWidth / 2, alignItems: 'center', justifyContent: 'center' },
});
