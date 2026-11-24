/**
 * One chat's messages and composer, shared by the buddy chat screen
 * (app/buddies/chat/[key].tsx) and a club's Chat tab (club-tabs.tsx). The
 * screen around it keeps its own top bar, menu and snackbar; reporting a
 * message is handed back to it, so a buddy chat can still offer "Also block".
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveFont, ThemedText } from '@/components/themed-text';
import { IconButton, ListRow, Sheet } from '@/components/ui';
import { chatItems, countLabel, MESSAGE_MAX } from '@/buddies/chat-logic';
import type { Message } from '@/buddies/types';
import { useChat } from '@/buddies/use-buddies';
import { MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { PLAIN_FIELD } from '@/constants/themes/plain';
import { useTheme } from '@/hooks/use-theme';

export function dayLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return 'Today';
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const timeOf = (at: number) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/**
 * The messages (newest at the bottom), the composer, and the long-press sheet
 * (Delete my own, Report someone else's). `group`: a club chat, so each run
 * of messages from someone else starts with their @handle.
 */
export function ChatBody({
  chatKey,
  name,
  group,
  show,
  onReportMessage,
}: {
  chatKey: string;
  name: string;
  group?: boolean;
  /** The screen's snackbar. */
  show: (message: string | null) => void;
  /** Report a message; `ref` is "<chat key>/<message id>", `author` who sent it (a club chat can block them). */
  onReportMessage: (ref: string, author: Message['from']) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const chat = useChat(chatKey);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Message | null>(null);

  const items = useMemo(() => chatItems(chat.messages, dayLabel).reverse(), [chat.messages]);

  const send = async () => {
    const t = text;
    if (!t.trim()) return;
    setText('');
    show(await chat.send(t));
  };

  const count = countLabel(text);

  return (
    <>
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
              sender={group && !item.message.mine && item.firstOfGroup ? `@${item.message.from.handle}` : null}
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
              style={resolveFont([Type.bodyLarge, PLAIN_FIELD, styles.input, { color: theme.onSurface }])}
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
              onReportMessage(`${chatKey}/${picked.id}`, picked.from);
              setPicked(null);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function Bubble({
  m,
  first,
  last,
  sender,
  onLongPress,
  onRetry,
}: {
  m: Message;
  first: boolean;
  last: boolean;
  sender: string | null;
  onLongPress: () => void;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const mine = m.mine;
  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left, { marginTop: first ? Spacing.three : Spacing.one }]}>
      {sender ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {sender}
        </ThemedText>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        onPress={m.state === 'failed' ? onRetry : undefined}
        accessibilityLabel={`${mine ? 'You' : (sender ?? 'Them')}: ${m.text}, ${timeOf(m.at)}`}
        style={[styles.bubble, { backgroundColor: mine ? theme.primary : theme.surfaceContainerHigh, opacity: m.state ? 0.55 : 1 }]}>
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
