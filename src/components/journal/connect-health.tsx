import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice, Why } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVitalsConnection } from '@/state/use-vitals';

/** Offers to read sleep, heart rate and BP from the health store; hidden once connected or where there's none. */
export function ConnectHealth({ what }: { what: string }) {
  const theme = useTheme();
  const vitals = useVitalsConnection();
  const [refused, setRefused] = useState(false);
  if (vitals.loading || vitals.connected || !vitals.available || !vitals.label) return null;

  return (
    <Card level={1}>
      <View style={styles.head}>
        <Ionicons name="watch-outline" size={24} color={theme.onSurfaceVariant} />
        <View style={styles.text}>
          <ThemedText type="titleMedium">Wear a watch or band?</ThemedText>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            Read your {what} from {vitals.label}
          </ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          variant="tonal"
          compact
          label={`Connect ${vitals.label}`}
          onPress={async () => setRefused(!(await vitals.connect()))}
        />
        <Why
          title={`Connect ${vitals.label}`}
          text={`If your watch's app saves to ${vitals.label}, this app can read your ${what} from there. Nothing leaves your phone.`}
        />
      </View>
      {refused ? <Notice text={`Nothing was allowed. You can change it in ${vitals.label}'s app permissions.`} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
});
