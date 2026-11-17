import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActiveTheme, type DataTone, MaxTextScale } from '@/constants/theme';
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
  active: string;
  idle: string;
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
 * The bottom bar (docs/design.md "Bottom bar", 17 Nov 2026): 60 dp plus the
 * system inset, a hairline above, three buttons with an icon over a label.
 * The selected one is in the active colour with a semibold label. Each slot
 * is 80 wide and has a touch area of at least 48 x 48.
 */
export function NavigationBar({ items, activeKey, onSelect, onReselect, bottomInset, colors }: NavigationBarProps) {
  const theme = useTheme();
  const c: NavigationBarColors = colors ?? {
    fill: theme.surfaceContainerLowest,
    hairline: theme.outlineVariant,
    active: theme.primary,
    idle: theme.onSurfaceVariant,
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
          onPress={() => (item.key === activeKey ? onReselect?.(item.key) : onSelect(item.key))}
        />
      ))}
    </View>
  );
}

function Destination({ item, active, color, onPress }: { item: NavigationItem; active: boolean; color: string; onPress: () => void }) {
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
      <View style={styles.visual}>
        {item.specIcon ? (
          <SpecIcon name={item.specIcon} color={color} size={NAV.iconSize} />
        ) : ionicon ? (
          <Ionicons name={ionicon} size={NAV.iconSize} color={color} />
        ) : null}
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={MaxTextScale}
          style={[styles.label, { color, fontFamily: active ? ActiveTheme.fonts.semibold.family : ActiveTheme.fonts.regular.family }]}>
          {item.label}
        </Text>
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
  },
  // The touch area is at least 48 x 48; the drawn slot sits in its middle.
  touch: { width: touch.width, minHeight: touch.height, alignItems: 'center', justifyContent: 'center' },
  visual: { width: NAV.slotWidth, minHeight: SLOT_VISUAL_HEIGHT, alignItems: 'center', gap: NAV.iconLabelGap },
  label: { fontSize: NAV.labelSize, lineHeight: NAV.labelLine, includeFontPadding: false, textAlign: 'center' },
});
