import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, useSnack } from '@/components/buddies/parts';
import { ReportSheet } from '@/components/buddies/report-sheet';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { ListRow, Screen, Snackbar, Surface } from '@/components/ui';
import { attempt, useSocialApi } from '@/buddies/use-buddies';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

/** A buddy: name and ID, Message, Remove, Block, Report. */
export default function WalkerScreen() {
  const { pid, name, handle } = useLocalSearchParams<{ pid: string; name?: string; handle?: string }>();
  const router = useRouter();
  const api = useSocialApi();
  const [reporting, setReporting] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const title = name || (handle ? `@${handle}` : 'Buddy');

  const run = async (action: () => Promise<void>, done: string) => {
    const err = await attempt(action);
    show(err ?? done);
    if (!err) setTimeout(back, 600);
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
      <Screen title={title} onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        <View style={styles.head}>
          <Avatar label={title} size={72} />
          <ThemedText type="titleLarge" maxFontSizeMultiplier={1.3}>
            {title}
          </ThemedText>
          {handle ? (
            <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
              @{handle}
            </ThemedText>
          ) : null}
        </View>
        <Surface level={1} style={styles.list}>
          <ListRow title="Message" icon="chatbubble-outline" chevron onPress={() => router.push({ pathname: '/buddies/chat/[key]', params: { key: `b.${pid}`, title } })} />
          <ListRow title="Remove buddy" icon="person-remove-outline" onPress={() => run(() => api.removeBuddy(pid), `Removed ${title}.`)} />
          <ListRow title="Block" icon="ban-outline" onPress={() => run(() => api.block(pid), `Blocked ${title}. They can't message you.`)} />
          <ListRow title="Report" icon="flag-outline" onPress={() => setReporting(true)} />
        </Surface>
      </Screen>
      <ReportSheet
        visible={reporting}
        label={title}
        canBlock
        onClose={() => setReporting(false)}
        onSend={async (reason, note, alsoBlock) => {
          setReporting(false);
          await run(async () => {
            await api.report({ kind: 'walker', pid, reason, note: note || undefined });
            if (alsoBlock) await api.block(pid);
          }, 'Thanks. Steps reviews every report, urgent ones within 24 hours.');
        }}
      />
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Spacing.one, marginVertical: Spacing.four },
  list: { overflow: 'hidden' },
});
