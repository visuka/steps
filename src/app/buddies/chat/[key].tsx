import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlainGround } from '@/components/plain/plain-kit';
import { ReportSheet } from '@/components/buddies/report-sheet';
import { useSnack } from '@/components/buddies/parts';
import { PremiumGate } from '@/components/premium-gate';
import { resolveFont, ThemedText } from '@/components/themed-text';
import { IconButton, ListRow, Sheet, Snackbar } from '@/components/ui';
import { chatItems, countLabel, MESSAGE_MAX } from '@/buddies/chat-logic';
import type { Message } from '@/buddies/types';
import { attempt, useChat, useSocialApi } from '@/buddies/use-buddies';
import { MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SCREEN_FEATURES } from '@/premium/premium';

function dayLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return 'Today';
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const timeOf = (at: number) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/** One chat (a buddy, later a club or the family): messages, composer, report and block. */
export default function ChatScreen() {
  const { key, title } = useLocalSearchParams<{ key: string; title?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const api = useSocialApi();
  const chat = useChat(key);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Message | null>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<{ kind: 'walker' | 'message'; ref?: string; label: string } | null>(null);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const isBuddy = key?.startsWith('b.');
  const pid = isBuddy ? key.slice(2) : undefined;
  const name = title || 'Chat';

  const items = useMemo(() => chatItems(chat.messages, dayLabel).reverse(), [chat.messages]);

  const send = async () => {
    const t = text;
    if (!t.trim()) return;
    setText('');
    show(await chat.send(t));
  };

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

  const count = countLabel(text);

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={name} onBack={back}>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: theme.background }]}>
        <PlainGround />
        <View style={[styles.top, { paddingTop: insets.top + Spacing.one }]}>
          <IconButton icon="arrow-back" accessibilityLabel="Back" onPress={back} />
          <ThemedText type="titleMedium" numberOfLines={1} style={styles.grow} maxFontSizeMultiplier={1.3}>
            {name}
          </ThemedText>
          <IconButton icon="ellipsis-vertical" accessibilityLabel="Menu" onPress={() => setMenu(true)} />
        </View>

        <FlatList
          inverted
          style={styles.fill}
          contentContainerStyle={styles.listPad}
          data={items}
          keyExtractor={(i) => i.key}
          ListFooterComponent={
            chat.loaded && !chat.messages.length ? (
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.center}>
                Say hello. Be kind; reports go to Steps.
              </ThemedText>
            ) : !chat.loaded ? (
              <ThemedText themeColor="onSurfaceVariant" style={styles.center}>
                —
              </ThemedText>
            ) : undefined
          }
          renderItem={({ item }) =>
            item.type === 'day' ? (
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.day}>
                {item.label}
              </ThemedText>
            ) : (
              <Bubble
                m={item.message}
                first={item.firstOfGroup}
                last={item.lastOfGroup}
                onLongPress={() => setPicked(item.message)}
                onRetry={async () => show(await chat.retry(item.message))}
              />
            )
          }
        />

        {chat.closed ? (
          <ThemedText themeColor="onSurfaceVariant" style={[styles.center, { paddingBottom: insets.bottom + Spacing.three }]}>
            {`You can't message ${name}.`}
          </ThemedText>
        ) : (
          <View style={[styles.composer, { borderTopColor: theme.outlineVariant, paddingBottom: insets.bottom + Spacing.two }]}>
            <View style={styles.grow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message"
                placeholderTextColor={theme.onSurfaceVariant}
                cursorColor={theme.primary}
                multiline
                maxLength={MESSAGE_MAX}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Message"
                style={resolveFont([Type.bodyLarge, styles.input, { color: theme.onSurface, backgroundColor: theme.surfaceContainerHigh }])}
              />
              {count ? (
                <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
                  {count}
                </ThemedText>
              ) : null}
            </View>
            <IconButton icon="send" variant="filled" accessibilityLabel="Send message" onPress={send} disabled={!text.trim()} />
          </View>
        )}
        <Snackbar message={snack} onDismiss={dismiss} />
      </KeyboardAvoidingView>

      <Sheet visible={!!picked} onClose={() => setPicked(null)} title="Message">
        {picked?.mine || picked?.state ? (
          <ListRow
            title="Delete"
            icon="trash-outline"
            onPress={async () => {
              const m = picked;
              setPicked(null);
              if (m) show(await chat.remove(m));
            }}
          />
        ) : null}
        {picked && !picked.mine && !picked.state ? (
          <ListRow
            title="Report"
            icon="flag-outline"
            onPress={() => {
              setReport({ kind: 'message', ref: `${key}/${picked.id}`, label: 'message' });
              setPicked(null);
            }}
          />
        ) : null}
      </Sheet>

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

function Bubble({ m, first, last, onLongPress, onRetry }: { m: Message; first: boolean; last: boolean; onLongPress: () => void; onRetry: () => void }) {
  const theme = useTheme();
  const mine = m.mine;
  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left, { marginTop: first ? Spacing.three : Spacing.one }]}>
      <Pressable
        onLongPress={onLongPress}
        onPress={m.state === 'failed' ? onRetry : undefined}
        accessibilityLabel={`${mine ? 'You' : 'Them'}: ${m.text}, ${timeOf(m.at)}`}
        style={[
          styles.bubble,
          { backgroundColor: mine ? theme.primary : theme.surfaceContainerHigh, opacity: m.state ? 0.55 : 1 },
        ]}>
        <ThemedText maxFontSizeMultiplier={1.3} style={{ color: mine ? theme.onPrimary : theme.onSurface }}>
          {m.text}
        </ThemedText>
      </Pressable>
      {m.state === 'failed' ? (
        <ThemedText type="bodySmall" themeColor="error" maxFontSizeMultiplier={1.3}>
          Not sent · Tap to retry
        </ThemedText>
      ) : last ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {m.state === 'sending' ? 'Sending…' : timeOf(m.at)}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingBottom: Spacing.one },
  listPad: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  center: { textAlign: 'center', marginTop: Spacing.four },
  day: { textAlign: 'center', marginVertical: Spacing.three },
  bubbleRow: { maxWidth: '78%', gap: 2 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 16 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, borderTopWidth: 1, paddingTop: Spacing.two, paddingHorizontal: Spacing.four },
  input: { minHeight: 48, maxHeight: 140, borderRadius: 20, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
