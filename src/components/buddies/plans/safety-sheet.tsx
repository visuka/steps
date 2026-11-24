/**
 * Walk safely (docs/walk-buddies.md 6.4): three short tips and a link, shown
 * once before the first Plan a walk and once on first joining a club
 * (use-plans.ts useSafetyTips). Theme roles and Spacing only.
 */
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Sheet } from '@/components/ui';
import { SAFETY_TIPS, SAFETY_URL } from '@/buddies/plans';
import { Spacing } from '@/constants/theme';

export function SafetySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Walk safely">
      <View style={styles.list}>
        {SAFETY_TIPS.map((t, i) => (
          <View key={t} style={styles.row} accessible accessibilityLabel={t}>
            <ThemedText type="titleSmall" themeColor="onSurfaceVariant" style={styles.num} maxFontSizeMultiplier={1.3}>
              {String(i + 1)}
            </ThemedText>
            <ThemedText style={styles.grow} maxFontSizeMultiplier={1.3}>
              {t}
            </ThemedText>
          </View>
        ))}
      </View>
      <Button label="More safety tips" variant="text" compact onPress={() => Linking.openURL(SAFETY_URL)} style={styles.link} />
      <Button label="OK" onPress={onClose} style={styles.gap} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, minHeight: Spacing.five },
  num: { minWidth: Spacing.three, textAlign: 'right' },
  grow: { flex: 1 },
  link: { alignSelf: 'flex-start', marginTop: Spacing.two },
  gap: { marginTop: Spacing.three },
});
