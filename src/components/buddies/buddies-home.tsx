/**
 * Buddies: Walk buddies in the plain sage-and-sand look (owner, 17 Nov 2026; the
 * mock is plain.html?s=m&k=1&ic=1&icx=1). Not joined yet → the sign-up form
 * (walker ID, the name buddies see, 18+ and the rules). Joined → Chats in the
 * sage tile, Requests (sand) and Find walkers, Buddies, your walker ID with
 * Share, My QR and Scan, Clubs (my role and one goal line each), Planned walks
 * (the next walks first, and Plan a walk), and My goals once a club counts
 * mine. Every chat, buddy and request opens as before.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/controls';
import { Btn, Caps, Label, Mid, Note, Num, Pair, plainStyles as ps, Sub, SyncLine, Tile, Words } from '@/components/plain/plain-kit';
import { PlainPage } from '@/components/plain/plain-page';
import { PLAIN } from '@/components/plain/plain-theme';
import { Button, Snackbar, ToggleRow } from '@/components/ui';
import { cleanHandle, handleProblem } from '@/buddies/chat-logic';
import { displayName } from '@/buddies/read';
import type { BuddyRow, ChatRow, SocialMe } from '@/buddies/types';
import { attempt, useLoad, useSocialApi, useSocialMe } from '@/buddies/use-buddies';
import { useMyClubs, useStepsShare } from '@/buddies/use-clubs';
import { clubGoalWords, digestWords } from '@/buddies/goals';
import { useGoalsAuto, useGoalsDigest } from '@/buddies/use-goals';
import { upcoming } from '@/buddies/plans';
import { usePlans } from '@/buddies/use-plans';
import { scaled } from '@/constants/ui-scale';
import { useClock } from '@/hooks/use-clock';
import { useClockStyle } from '@/hooks/use-clock-style';
import { minutesAgo } from '@/lib/format';
import { useApp } from '@/state/app-state';

import { GroupsTile } from './clubs/groups-tile';
import { PlannedWalksTile } from './plans/planned-walks-tile';
import { MyQrSheet } from './qr/qr-sheets';
import { useSnack } from './parts';

const S = scaled;

export type Segment = 'chats' | 'buddies';

export function BuddiesHome({ openQr }: { initialSegment?: Segment; /** Design preview: open My QR. */ openQr?: boolean } = {}) {
  const { me, setMe, error, loading, refresh } = useSocialMe();
  if (!me) {
    return (
      <PlainPage onRefresh={refresh}>
        <Sub lead="Walk buddies" />
        <Tile>
          {loading ? (
            <Note>—</Note>
          ) : (
            <>
              <Label icon="chat" text="Can't reach Walk buddies" />
              {error?.message ? <Note>{error.message}</Note> : null}
              <View style={[ps.row, { marginTop: S(12) }]}>
                <Btn text="Try again" kind="main" onPress={refresh} />
              </View>
            </>
          )}
        </Tile>
      </PlainPage>
    );
  }
  if (!me.joined) return <JoinForm onJoined={setMe} />;
  return <Joined me={me} refreshMe={refresh} openQr={openQr} />;
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
    <PlainPage overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      <Sub lead="Walk buddies" />
      <Tile kind="hero">
        <Label icon="people" text="Join Walk buddies" />
        <Note style={{ marginTop: S(8) }}>Find walkers by their ID, become walk buddies and chat. Only accepted buddies can message you.</Note>
      </Tile>
      <Tile>
        <Label icon="card" text="Your walker ID" />
        <View style={{ marginTop: S(10) }}>
          <TextField label="Walker ID" value={handle} onChangeText={setHandle} placeholder="@your_id" maxLength={21} plain />
        </View>
        <Note color={problem ? PLAIN.warn : PLAIN.muted}>{problem ?? '3–20 letters, numbers or _. You can change it once a month.'}</Note>
        <View style={{ marginTop: S(12) }}>
          <TextField label="Name buddies see" value={name} onChangeText={setName} placeholder="Your name" maxLength={40} />
        </View>
        <Note>Leave empty to show your ID.</Note>
      </Tile>
      <Tile>
        <ToggleRow title="I'm 18 or older" value={adult} onValueChange={setAdult} />
        <ToggleRow title="I agree to the Walk buddies rules" value={rules} onValueChange={setRules} />
        <View style={styles.links}>
          <Button label="Rules" variant="text" compact onPress={() => Linking.openURL('https://neutcrafts.in/walk-buddies-rules')} />
          <Button label="Terms" variant="text" compact onPress={() => Linking.openURL('https://neutcrafts.in/terms')} />
          <Button label="Privacy" variant="text" compact onPress={() => Linking.openURL('https://neutcrafts.in/privacy')} />
        </View>
      </Tile>
      <Button label="Continue" onPress={join} disabled={!ready} loading={busy} />
    </PlainPage>
  );
}

function Joined({ me, refreshMe, openQr }: { me: Extract<SocialMe, { joined: true }>; refreshMe: () => Promise<void>; openQr?: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState(!!openQr);
  const api = useSocialApi();
  const chats = useLoad(api.chats);
  const buddies = useLoad(api.buddies);
  const requests = useLoad(api.requests);
  const clubs = useMyClubs();
  const plans = usePlans();
  const now = useClock().now;
  const clock = useClockStyle();
  // Today's and this week's steps for the club boards, only while a board is on (steps-share.ts).
  useStepsShare();
  // Shared club goals the phone counts (steps, walk, water, sleep), at most every 15 minutes (goals-auto.ts).
  useGoalsAuto();
  const goals = useGoalsDigest(clubs.data);
  const goalsLine = digestWords(goals.digest, goals.clubs);
  const goalLines: Record<string, string | null> = {};
  for (const [id, g] of Object.entries(goals.byClub ?? {})) goalLines[id] = clubGoalWords(g, goals.today);
  const { snack, show, dismiss } = useSnack();
  const [later, setLater] = useState(false);
  // When the chats last came in, for "Updated 2 min ago" (set as they arrive, not in an effect).
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [seenChats, setSeenChats] = useState(chats.data);
  if (chats.data !== seenChats) {
    setSeenChats(chats.data);
    if (chats.data) setLoadedAt(new Date().getTime());
  }

  const refresh = async () => {
    goals.refresh();
    await Promise.all([refreshMe(), chats.refresh(), buddies.refresh(), requests.refresh(), clubs.refresh(), plans.refresh()]);
  };

  const incoming = requests.data?.incoming ?? [];
  const first = incoming[0];
  const buddyCount = buddies.data?.length ?? 0;
  const reqCount = incoming.length || me.counts.requestsIn;
  const unread = me.counts.unread;
  const openChat = (c: ChatRow) => router.push({ pathname: '/buddies/chat/[key]', params: { key: c.key, title: c.title } });
  const openWalker = (b: BuddyRow) =>
    router.push({ pathname: '/buddies/walker/[pid]', params: { pid: b.walker.pid, name: b.walker.name ?? '', handle: b.walker.handle } });
  const find = () => router.push('/buddies/find');
  const accept = async (pid: string, handle: string) => {
    show((await attempt(() => api.accept(pid))) ?? `You and @${handle} are now buddies.`);
    await refresh();
  };

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const subRest = [count(buddyCount, 'buddy', 'buddies'), reqCount ? count(reqCount, 'request', 'requests') : null].filter(Boolean).join(' · ');

  return (
    <PlainPage onRefresh={refresh} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      <Sub lead="Walk buddies" rest={subRest} />

      <Tile kind="hero" style={{ paddingBottom: S(8) }}>
        <View style={ps.spread}>
          <Label icon="chat" text="Chats" />
          {unread ? <Caps text={`${unread} unread`} /> : null}
        </View>
        {chats.data && chats.data.length === 0 ? (
          <View style={{ paddingVertical: S(8) }}>
            <Note>No chats yet. Chats open once someone accepts your buddy request.</Note>
          </View>
        ) : (
          (chats.data ?? []).map((c) => <ChatLine key={c.key} c={c} onPress={() => openChat(c)} />)
        )}
        {chats.error ? <Note style={{ paddingVertical: S(8) }}>{chats.error}</Note> : null}
      </Tile>

      <Pair>
        <Tile kind="second" style={ps.half} onPress={() => router.push('/buddies/requests')} label={`Requests, ${reqCount} new`}>
          <Label icon="useradd" text="Requests" />
          <Num value={String(reqCount)} unit="new" />
          <Note lines={2}>{first ? `${displayName(first.walker)} wants to walk` : 'Asked you, and who you asked'}</Note>
          {first && !later ? (
            <View style={[ps.footRow, { gap: S(6) }]}>
              <Btn text="Accept" kind="main" onPress={() => accept(first.walker.pid, first.walker.handle)} label={`Accept ${displayName(first.walker)}`} />
              <Btn text="Later" kind="onSecond" onPress={() => setLater(true)} />
            </View>
          ) : null}
        </Tile>
        <Tile style={ps.half} onPress={find} label="Find walkers by their walker ID">
          <Label icon="search" text="Find walkers" />
          <Mid value="By walker ID" style={{ marginTop: S(8) }} fit />
          <Note lines={2}>Ask a friend for theirs</Note>
          <View style={ps.footRow}>
            <Btn text="Find" kind="main" onPress={find} label="Find walkers" />
          </View>
        </Tile>
      </Pair>

      <Tile>
        <Label icon="people" text="Buddies" />
        <View style={[styles.people, { marginTop: S(12) }]}>
          {(buddies.data ?? []).map((b) => (
            <Person key={b.walker.pid} name={displayName(b.walker)} onPress={() => openWalker(b)} />
          ))}
          <Pressable onPress={find} accessibilityRole="button" accessibilityLabel="Add a buddy" style={styles.person}>
            <View style={[styles.av, styles.add]}>
              <Words size={22} color={PLAIN.muted} line={26}>
                +
              </Words>
            </View>
            <Note style={{ marginTop: 0 }}>Add</Note>
          </Pressable>
        </View>
        {buddies.error ? <Note>{buddies.error}</Note> : null}
      </Tile>

      <Tile>
        <View style={ps.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label icon="card" text="Your walker ID" />
            <Mid value={`@${me.handle}`} style={{ marginTop: S(6) }} fit />
            <Note lines={1}>Share it so friends can add you</Note>
          </View>
          <Btn text="Share" kind="main" onPress={() => Share.share({ message: `Walk with me on Steps. My walker ID is @${me.handle}` })} label="Share your walker ID" />
        </View>
        <View style={ps.footRow}>
          <Btn text="My QR" onPress={() => setQr(true)} label="Show my QR code" />
          <Btn text="Scan" onPress={() => router.push('/buddies/scan' as never)} label="Scan a friend's or a club's QR code" />
        </View>
      </Tile>
      <MyQrSheet visible={qr} onClose={() => setQr(false)} handle={me.handle} />

      <GroupsTile
        clubs={clubs.data}
        error={clubs.error}
        asking={me.counts.clubRequests}
        goalLines={goalLines}
        onOpen={(c) => router.push({ pathname: '/buddies/club/[id]', params: { id: c.clubId } } as never)}
        onFind={() => router.push('/buddies/clubs' as never)}
        onStart={() => router.push('/buddies/club/new' as never)}
      />
      <PlannedWalksTile
        plans={plans.data ? upcoming(plans.data, now) : null}
        error={plans.error}
        now={now}
        clock={clock}
        onOpen={(p) => router.push({ pathname: '/buddies/plan/[id]', params: { id: p.planId } } as never)}
        onPlan={() => router.push('/buddies/plan/new' as never)}
      />

      {/* My goals, once a club counts my goals (I said yes to goal tracking there). */}
      {goals.tracked ? (
        <Tile style={[ps.spread, { paddingTop: S(12), paddingBottom: S(12) }]} onPress={() => router.push('/buddies/goals' as never)} label={`My goals, ${goalsLine}`}>
          <Label icon="check" text="My goals" />
          <Note style={{ marginTop: 0 }} lines={1}>
            {goalsLine}
          </Note>
        </Tile>
      ) : null}

      <SyncLine text={loadedAt ? `Updated ${minutesAgo(loadedAt)}` : 'Updating…'} />
    </PlainPage>
  );
}

/** One chat: the initial, the name over the last line, the time and unread count. */
function ChatLine({ c, onPress }: { c: ChatRow; onPress: () => void }) {
  const title = c.title || 'Chat';
  const line = c.lastText ? `${c.lastMine ? 'You: ' : ''}${c.lastText}` : c.unread ? 'New messages' : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${c.unread ? `, ${c.unread} new` : ''}`}
      android_ripple={{ color: PLAIN.ripple }}
      style={[ps.row, { paddingVertical: S(8) }]}>
      <View style={[styles.av, { width: S(40), height: S(40), borderRadius: S(20) }]}>
        <Words size={15} weight={600} line={18}>
          {letter(title)}
        </Words>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Words size={15} weight={600} line={19} lines={1}>
          {title}
        </Words>
        {line ? (
          <Note lines={1} color={c.unread ? PLAIN.text : PLAIN.muted}>
            {line}
          </Note>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Note style={{ marginTop: 0 }}>{shortTime(c.lastAt)}</Note>
        {c.unread ? (
          <View style={styles.badge}>
            <Words size={11} weight={600} color={PLAIN.onMain} line={20}>
              {String(c.unread)}
            </Words>
          </View>
        ) : (
          <View style={{ height: S(24) }} />
        )}
      </View>
    </Pressable>
  );
}

/** A buddy: a 48 initial circle over the name. */
function Person({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name} style={styles.person}>
      <View style={styles.av}>
        <Words size={18} weight={600} line={22}>
          {letter(name)}
        </Words>
      </View>
      <Note style={{ marginTop: 0 }} color={PLAIN.text} lines={1}>
        {name.split(' ')[0]}
      </Note>
    </Pressable>
  );
}

function letter(label: string): string {
  return label.replace(/^@/, '').trim().charAt(0).toUpperCase() || '?';
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
  // Text links are bare words now: 24 apart (their 48 dp targets meet, never overlap), on the switches' text edge.
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: S(8), paddingHorizontal: 16 },
  // Five across fill the tile as on the mock (56 wide, 13.75 apart); more wrap to a new row.
  // Pulled back by half of 56 less 48, so the first circle sits on the tile's shared left edge.
  people: { flexDirection: 'row', flexWrap: 'wrap', columnGap: S(13.75), rowGap: S(12), marginLeft: -S(4) },
  person: { alignItems: 'center', gap: S(6), width: S(56) },
  av: { width: S(48), height: S(48), borderRadius: S(24), backgroundColor: PLAIN.chip, alignItems: 'center', justifyContent: 'center' },
  add: { backgroundColor: PLAIN.field, borderWidth: 1, borderColor: PLAIN.hairline },
  // As wide as the time above it at least, as on the mockup (a block under the time).
  badge: { minWidth: S(20), height: S(20), borderRadius: S(10), backgroundColor: PLAIN.sand, paddingHorizontal: S(6), alignItems: 'center', alignSelf: 'stretch', marginTop: S(4) },
});
