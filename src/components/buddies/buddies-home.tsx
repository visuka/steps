/**
 * The Plus tab: Walk buddies. Not joined yet → the sign-up form (walker ID,
 * the name buddies see, 18+ and the rules). Joined → Chats and Buddies, with
 * requests and Find walkers on top. Clubs, family, walk plans and QR come in
 * the next builds and are listed as such.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Segmented, TextField } from '@/components/controls';
import { Button, EmptyState, ListRow, Pill, Screen, Snackbar, Surface, ToggleRow } from '@/components/ui';
import { cleanHandle, handleProblem } from '@/buddies/chat-logic';
import { displayName } from '@/buddies/read';
import type { ChatRow, SocialMe } from '@/buddies/types';
import { attempt, useLoad, useSocialApi, useSocialMe } from '@/buddies/use-buddies';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/state/app-state';

import { Avatar, PersonRow, SectionTitle, useSnack } from './parts';

/** Still to come on this tab; shown so nothing promised disappears. */
const COMING = [
  { key: 'groups', title: 'Groups and clubs', supporting: 'Walk and cycle together', icon: 'people-outline' },
  { key: 'plans', title: 'Walk plans', supporting: 'Pick a time and place to meet', icon: 'calendar-outline' },
  { key: 'qr', title: 'Add by QR code', supporting: 'Scan to add a buddy or join a club', icon: 'qr-code-outline' },
] as const;

type Segment = 'chats' | 'buddies';

export function BuddiesHome() {
  const { me, setMe, error, loading, refresh } = useSocialMe();
  if (!me) {
    return (
      <Screen title="Chats and buddies">
        {loading ? (
          <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
        ) : (
          <EmptyState icon="cloud-offline-outline" title="Can't reach Walk buddies" hint={error?.message} action={{ label: 'Try again', onPress: refresh }} />
        )}
      </Screen>
    );
  }
  if (!me.joined) return <JoinForm onJoined={setMe} />;
  return <Joined me={me} refreshMe={refresh} />;
}

function JoinForm({ onJoined }: { onJoined: (me: SocialMe) => void }) {
  const api = useSocialApi();
  const { profile } = useApp();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState(profile.name ?? '');
  const [adult, setAdult] = useState(false);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const problem = handle ? handleProblem(handle) : null;
  const ready = !!handle && !problem && adult && rules && !busy;

  const join = async () => {
    setBusy(true);
    let joined: SocialMe | null = null;
    show(await attempt(async () => (joined = await api.join(cleanHandle(handle), name.trim()))));
    setBusy(false);
    if (joined) onJoined(joined);
  };

  return (
    <Screen title="Walk buddies" overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        Find walkers by their ID, become walk buddies and chat. Only accepted buddies can message you.
      </ThemedText>
      <SectionTitle>Your walker ID</SectionTitle>
      <TextField label="Walker ID" value={handle} onChangeText={setHandle} placeholder="@your_id" maxLength={21} />
      <ThemedText type="bodySmall" themeColor={problem ? 'error' : 'onSurfaceVariant'} maxFontSizeMultiplier={1.3}>
        {problem ?? '3–20 letters, numbers or _. You can change it once a month.'}
      </ThemedText>
      <SectionTitle>Name buddies see</SectionTitle>
      <TextField label="Name buddies see" value={name} onChangeText={setName} placeholder="Your name" maxLength={40} />
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        Leave empty to show your ID.
      </ThemedText>
      <Surface level={1} style={styles.list}>
        <ToggleRow title="I'm 18 or older" value={adult} onValueChange={setAdult} />
        <ToggleRow title="I agree to the Walk buddies rules" value={rules} onValueChange={setRules} />
      </Surface>
      <View style={styles.links}>
        <Button label="Rules" variant="text" compact onPress={() => Linking.openURL('https://neutcrafts.in/walk-buddies-rules')} />
        <Button label="Terms" variant="text" compact onPress={() => Linking.openURL('https://neutcrafts.in/terms')} />
        <Button label="Privacy" variant="text" compact onPress={() => Linking.openURL('https://neutcrafts.in/privacy')} />
      </View>
      <Button label="Continue" onPress={join} disabled={!ready} loading={busy} />
    </Screen>
  );
}

function Joined({ me, refreshMe }: { me: Extract<SocialMe, { joined: true }>; refreshMe: () => Promise<void> }) {
  const router = useRouter();
  const api = useSocialApi();
  const [segment, setSegment] = useState<Segment>('chats');
  const chats = useLoad(api.chats);
  const buddies = useLoad(api.buddies);
  const requests = me.counts.requestsIn;

  const refresh = async () => {
    await Promise.all([refreshMe(), chats.refresh(), buddies.refresh()]);
  };

  return (
    <Screen title="Chats and buddies" subtitle={`You are @${me.handle}`} refreshing={false} onRefresh={refresh}>
      <Segmented<Segment>
        options={[
          { value: 'chats', label: me.counts.unread ? `Chats (${me.counts.unread})` : 'Chats' },
          { value: 'buddies', label: 'Buddies' },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <Surface level={1} style={styles.list}>
        <ListRow
          title="Requests"
          supporting={requests ? `${requests} waiting for you` : 'Asked you, and who you asked'}
          icon="notifications-outline"
          trailing={requests ? <Pill label={String(requests)} /> : undefined}
          chevron
          onPress={() => router.push('/buddies/requests')}
        />
        <ListRow title="Find walkers" supporting="By their walker ID" icon="search-outline" chevron onPress={() => router.push('/buddies/find')} />
      </Surface>

      {segment === 'chats' ? (
        <ChatList rows={chats.data} error={chats.error} onOpen={(c) => router.push({ pathname: '/buddies/chat/[key]', params: { key: c.key, title: c.title } })} onFind={() => router.push('/buddies/find')} />
      ) : buddies.data && buddies.data.length === 0 ? (
        <EmptyState icon="people-outline" title="No buddies yet" hint="Find a walker by their ID." action={{ label: 'Find walkers', onPress: () => router.push('/buddies/find') }} />
      ) : (
        <Surface level={1} style={styles.list}>
          {(buddies.data ?? []).map((b, i, all) => (
            <PersonRow
              key={b.walker.pid}
              walker={b.walker}
              last={i === all.length - 1}
              onPress={() => router.push({ pathname: '/buddies/walker/[pid]', params: { pid: b.walker.pid, name: b.walker.name ?? '', handle: b.walker.handle } })}
            />
          ))}
          {buddies.error ? <ListRow title={buddies.error} icon="alert-circle-outline" onPress={buddies.refresh} /> : null}
        </Surface>
      )}

      <SectionTitle>Coming next</SectionTitle>
      <Surface level={1} style={styles.list}>
        {COMING.map((r) => (
          <ListRow key={r.key} icon={r.icon} title={r.title} supporting={r.supporting} disabled />
        ))}
      </Surface>
    </Screen>
  );
}

function ChatList({
  rows,
  error,
  onOpen,
  onFind,
}: {
  rows: ChatRow[] | null;
  error: string | null;
  onOpen: (c: ChatRow) => void;
  onFind: () => void;
}) {
  if (rows && rows.length === 0) {
    return <EmptyState icon="chatbubbles-outline" title="No chats yet" hint="Chats open once someone accepts your buddy request." action={{ label: 'Find walkers', onPress: onFind }} />;
  }
  return (
    <Surface level={1} style={styles.list}>
      {(rows ?? []).map((c, i, all) => (
        <ListRow
          key={c.key}
          tall
          last={i === all.length - 1}
          title={c.title || 'Chat'}
          supporting={c.lastText ? `${c.lastMine ? 'You: ' : ''}${c.lastText}` : c.unread ? 'New messages' : undefined}
          leading={<Avatar label={c.title || '?'} />}
          trailing={c.unread ? <Pill label={String(c.unread)} /> : <ThemedText type="bodySmall" themeColor="onSurfaceVariant">{shortTime(c.lastAt)}</ThemedText>}
          onPress={() => onOpen(c)}
          accessibilityLabel={`${c.title}${c.unread ? `, ${c.unread} new` : ''}`}
        />
      ))}
      {error ? <ListRow title={error} icon="alert-circle-outline" /> : null}
    </Surface>
  );
}

/** "7:10 am" today, else "14 Nov". */
export function shortTime(at: number, now = Date.now()): string {
  if (!at) return '';
  const d = new Date(at);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export { displayName };

const styles = StyleSheet.create({
  list: { overflow: 'hidden', marginTop: Spacing.three },
  links: { flexDirection: 'row', gap: Spacing.three, marginVertical: Spacing.two },
});
