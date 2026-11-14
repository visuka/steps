/** "Walk in progress" (spec 10.3): a 72 dp card between the hero and the tiles; the whole card opens the walk. */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconCircle, SpecIcon } from '@/components/ui';
import { CARD_LOOK, pressedColor } from '@/components/ui/surface-style';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';

import { walkingSpoken } from './today-actions';

export function WalkingCard({ line, onPress }: { line: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest, boxShadow: CARD_LOOK.boxShadow }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={walkingSpoken(line)}
        accessibilityHint="Opens the walk to see it or finish"
        android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
        style={styles.press}>
        <IconCircle name="walker" tone="accent" />
        <View style={styles.text}>
          <ThemedText type="titleSmall" maxFontSizeMultiplier={1.3}>
            Walk in progress
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {line}
          </ThemedText>
        </View>
        <SpecIcon name="chevron-right" color={theme.onSurfaceVariant} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_LOOK.radius },
  press: {
    minHeight: CLEAN_SPEC.sizes.statCard.height,
    paddingHorizontal: CLEAN_SPEC.space.s16,
    borderRadius: CARD_LOOK.radius,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: CLEAN_SPEC.space.s12,
  },
  text: { flex: 1, minWidth: 0 },
});
