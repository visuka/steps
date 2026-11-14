import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Controls } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { FAB_STYLE } from './fab-style';

import { pressedColorOnAccent } from './surface-style';

/**
 * The extended FAB: the one primary action of a screen, 56 dp tall with 28 dp
 * corners and the spec's fab shadow, in the accent colour so it is found at a
 * glance outdoors. One per screen. Pass it to <Screen fab={…} />, which places
 * it above the navigation bar. (The round FAB in the bottom bar is drawn by
 * navigation-bar.tsx.) The shadow sits on an outer View so the ripple's clip
 * does not cut it off.
 */
export function ExtendedFab({
  label,
  icon,
  onPress,
  accessibilityHint,
  style,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.shadow, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        android_ripple={{ color: pressedColorOnAccent(theme.onPrimary), foreground: true }}
        style={[styles.fab, { backgroundColor: theme.primary }]}>
        <Ionicons name={icon} size={FAB_STYLE.iconSize} color={theme.onPrimary} />
        <ThemedText
          type="labelLarge"
          maxFontSizeMultiplier={1.3}
          style={[Controls.buttonLabel, { color: theme.onPrimary }]}
          numberOfLines={1}>
          {label}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: FAB_STYLE.radius, boxShadow: FAB_STYLE.boxShadow },
  fab: {
    minHeight: FAB_STYLE.minHeight,
    minWidth: FAB_STYLE.minWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAB_STYLE.gap,
    paddingLeft: FAB_STYLE.paddingLeft,
    paddingRight: FAB_STYLE.paddingRight,
    borderRadius: FAB_STYLE.radius,
    overflow: 'hidden',
  },
});

export { BAR_FAB_CLEARANCE } from './fab-style';
