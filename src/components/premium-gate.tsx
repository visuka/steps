import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
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
    <Card>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={22} color={theme.accent} />
        <ThemedText style={styles.title}>{APP_NAME} Premium</ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">Today&apos;s steps are free, always. Premium adds:</ThemedText>
      <View style={styles.list}>
        {PREMIUM_FEATURES.map((f) => (
          <View key={f.key} style={styles.item}>
            <Ionicons name="checkmark-circle" size={18} color={theme.accent} style={styles.tick} />
            <ThemedText style={styles.itemText}>{f.label}</ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Your steps are still counted and kept, so your history will be here when you have Premium.
      </ThemedText>

      {premium.state.checkedAt === null && premium.checking ? (
        <ThemedText type="small" themeColor="textSecondary">
          Checking your account…
        </ThemedText>
      ) : testing ? (
        <>
          <ThemedText type="smallBold">Premium is free while we test</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You&apos;re seeing the app as a free user. Turn this off in Settings, or here.
          </ThemedText>
          <Button label="Stop previewing" onPress={() => premium.setPreviewFree(false)} />
        </>
      ) : (
        <>
          <ThemedText type="smallBold">Coming soon</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You&apos;ll be able to get Premium here soon.
          </ThemedText>
          {/* Never answered on this phone (a new install that was offline): it may be premium already. */}
          {premium.state.checkedAt === null ? (
            <Button kind="secondary" label="Check again" onPress={() => premium.refresh()} />
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  list: { gap: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  tick: { marginTop: 3 },
  itemText: { flex: 1 },
});
