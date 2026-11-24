import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlainGround } from '@/components/plain/plain-kit';
import { ChatBody } from '@/components/buddies/chat-body';
import { ReportSheet } from '@/components/buddies/report-sheet';
import { useSnack } from '@/components/buddies/parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { BackButton, IconButton, ListRow, Sheet, Snackbar } from '@/components/ui';
import { SCREEN } from '@/components/ui/screen-style';
import { attempt, useSocialApi } from '@/buddies/use-buddies';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SCREEN_FEATURES } from '@/premium/premium';

/** One chat (a buddy, later a club or the family): messages, composer, report and block. */
export default function ChatScreen() {
  const { key, title } = useLocalSearchParams<{ key: string; title?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const api = useSocialApi();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<{ kind: 'walker' | 'message'; ref?: string; label: string } | null>(null);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const isBuddy = key?.startsWith('b.');
  const pid = isBuddy ? key.slice(2) : undefined;
  const name = title || 'Chat';

  const block = async () => {
    if (!pid) return;
    setMenu(false);
    const err = await attempt(() => api.block(pid));
    show(err ?? `Blocked ${name}. They can't message you.`);
    if (!err) back();
  };

  const removeBuddy = async () => {
    if (!pid) return;
    setMenu(false);
    const err = await attempt(() => api.removeBuddy(pid));
    show(err);
    if (!err) back();
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={name} onBack={back}>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: theme.background }]}>
        <PlainGround />
        <View style={[styles.top, { paddingTop: insets.top + Spacing.one }]}>
          {/* The same back chevron and title as every pushed screen (Screen, the club page). */}
          <BackButton onPress={back} />
          <ThemedText
            type="headlineSmall"
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.grow}
            maxFontSizeMultiplier={1.3}>
            {name}
          </ThemedText>
          <IconButton icon="ellipsis-vertical" accessibilityLabel="Menu" onPress={() => setMenu(true)} />
        </View>

        <ChatBody chatKey={key} name={name} show={show} onReportMessage={(ref) => setReport({ kind: 'message', ref, label: 'message' })} />
        <Snackbar message={snack} onDismiss={dismiss} />
      </KeyboardAvoidingView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={name}>
        {pid ? (
          <>
            <ListRow title="See buddy" icon="person-outline" onPress={() => (setMenu(false), router.push({ pathname: '/buddies/walker/[pid]', params: { pid, name } }))} />
            <ListRow title="Remove buddy" icon="person-remove-outline" onPress={removeBuddy} />
            <ListRow title="Block" icon="ban-outline" onPress={block} />
            <ListRow title="Report" icon="flag-outline" onPress={() => (setMenu(false), setReport({ kind: 'walker', label: name }))} />
          </>
        ) : null}
      </Sheet>

      <ReportSheet
        visible={!!report}
        label={report?.label ?? ''}
        onClose={() => setReport(null)}
        canBlock={!!pid}
        onSend={async (reason, note, alsoBlock) => {
          const r = report;
          setReport(null);
          if (!r) return;
          const err = await attempt(async () => {
            await api.report({ kind: r.kind, pid, ref: r.ref, reason, note: note || undefined });
            if (alsoBlock && pid) await api.block(pid);
          });
          show(err ?? 'Thanks. Steps reviews every report, urgent ones within 24 hours.');
          if (!err && alsoBlock) back();
        }}
      />
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  // The chevron sits where Screen puts it (24 margin, -4), the title 8 after it.
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SCREEN.back.titleGap,
    minHeight: SCREEN.topBarHeight,
    paddingLeft: SCREEN.sideMargin,
    paddingRight: Spacing.two,
    paddingBottom: Spacing.one,
  },
});
