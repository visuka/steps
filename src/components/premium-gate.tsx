import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice, Screen, Why } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Feature, PREMIUM_FEATURES } from '@/premium/premium';
import { usePremium } from '@/state/use-premium';

/**
 * The one lock: `children` when this account can use `feature`, else the
 * Steps Premium card in their place. With `title` a whole screen is locked,
 * and the card gets the screen around it (`onBack` for pushed screens).
 */
export function PremiumGate({
  feature,
  title,
  onBack,
  children,
}: {
  feature: Feature;
  title?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  const premium = usePremium();
  if (!premium.isLocked(feature)) return children;
  if (!title) return <PremiumCard />;
  return (
    <Screen title={title} onBack={onBack}>
      <PremiumCard />
    </Screen>
  );
}

/** What Steps Premium adds, and how to get it. Purchases go here once there are any. */
export function PremiumCard() {
  const premium = usePremium();
  const theme = useTheme();
  // Only a tester previewing the free app sees this while premium is free for testing.
  const testing = premium.state.reason === 'testing';

  return (
    <Card
      level={1}
      title={`${APP_NAME} Premium`}
      right={
        <Why
          title={`${APP_NAME} Premium`}
          text="Today's steps are free, always. Your steps are still counted and kept, so your history will be here when you have Premium."
        />
      }>
      <View style={styles.list}>
        {PREMIUM_FEATURES.map((f) => (
          <View key={f.key} style={styles.item}>
            <Ionicons name="checkmark" size={20} color={theme.onSurfaceVariant} style={styles.tick} />
            <ThemedText type="bodyMedium" style={styles.itemText}>
              {f.label}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        Today&apos;s steps stay free.
      </ThemedText>

      {premium.state.checkedAt === null && premium.checking ? (
        <Notice text="Checking your account…" />
      ) : testing ? (
        <>
          <Notice text="Free while we test. You're previewing the free app." />
          <Button label="Stop previewing" onPress={() => premium.setPreviewFree(false)} />
        </>
      ) : (
        <>
          <ThemedText type="titleSmall">Coming soon</ThemedText>
          {/* Never answered on this phone (a new install that was offline): it may be premium already. */}
          {premium.state.checkedAt === null ? (
            <Button variant="tonal" label="Check again" onPress={() => premium.refresh()} />
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  tick: { marginTop: 0 },
  itemText: { flex: 1 },
});
