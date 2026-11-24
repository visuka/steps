import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { PersonRow, SectionTitle, useSnack } from '@/components/buddies/parts';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Dialog, Screen, Snackbar, Surface } from '@/components/ui';
import { currentArea } from '@/buddies/area';
import { handleProblem, searchHandle } from '@/buddies/chat-logic';
import { linkHandle } from '@/buddies/qr/links';
import { SocialError } from '@/buddies/read';
import type { Nearby, Walker } from '@/buddies/types';
import { attempt, useSocialApi, useSocialMe } from '@/buddies/use-buddies';
import { Spacing } from '@/constants/theme';
import { useClock } from '@/hooks/use-clock';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Find a walker by their ID, then ask them to be buddies. `handle` (a scanned
 * walker QR or a walker link) fills the ID and looks it up once.
 */
export default function FindWalkers() {
  const { handle: handleParam } = useLocalSearchParams<{ handle?: string }>();
  const linked = linkHandle(handleParam);
  const router = useRouter();
  const api = useSocialApi();
  const { me, refresh: refreshMe } = useSocialMe();
  const today = useClock().today;
  const [near, setNear] = useState<Nearby | null>(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [explain, setExplain] = useState(false);
  const [q, setQ] = useState(linked ?? '');
  const [found, setFound] = useState<Walker | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const on = !!(me && me.joined && me.nearby);
  const areaDay = me && me.joined ? me.areaSetOn : null;

  // While shown: send the area again once a day (it lapses after 8 days), then list who is near.
  const loadNear = useCallback(async () => {
    if (!on) return setNear(null);
    if (areaDay !== today) {
      const area = await currentArea(false);
      if (area) await api.setArea(area).catch(() => undefined);
    }
    try {
      setNear(await api.nearby());
    } catch (e) {
      show(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    }
  }, [on, areaDay, today, api, show]);

  useFocusEffect(
    useCallback(() => {
      void loadNear();
    }, [loadNear]),
  );

  const turnOn = async () => {
    setExplain(false);
    setNearBusy(true);
    try {
      const area = await currentArea(true);
      if (!area) return show("Location is off, so walkers in your area can't be shown. Finding by ID still works.");
      await api.setArea(area);
      await refreshMe();
    } catch (e) {
      show(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setNearBusy(false);
    }
  };

  const turnOff = async () => {
    setNearBusy(true);
    const err = await attempt(() => api.clearArea());
    if (err) show(err);
    else {
      setNear(null);
      await refreshMe();
    }
    setNearBusy(false);
  };

  const search = () => lookUp(q);

  const lookUp = async (text: string) => {
    const h = searchHandle(text);
    // The keyboard would hide the message below.
    Keyboard.dismiss();
    const problem = handleProblem(h);
    if (problem) return show(problem);
    if (me?.joined && me.handle.toLowerCase() === h.toLowerCase()) {
      setFound(null);
      setMissing(false);
      return show('That is your own ID. Ask your friend for theirs.');
    }
    setBusy(true);
    setFound(null);
    setMissing(false);
    try {
      setFound(await api.findWalker(h));
    } catch (e) {
      if (e instanceof SocialError && e.kind === 'not_found') setMissing(true);
      else show(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // A scanned or linked walker ID: look it up once, after my own ID is known (so my own code says so).
  const looked = useRef(false);
  useEffect(() => {
    if (!linked || !me || looked.current) return;
    looked.current = true;
    void lookUp(linked);
  });

  const ask = async (w: Walker) => {
    const box: { state: 'requested' | 'buddies' } = { state: 'requested' };
    const err = await attempt(async () => {
      box.state = await api.ask(w.pid);
    });
    if (err) return show(err);
    const state = box.state;
    const next: Walker = { ...w, relation: state === 'buddies' ? 'buddy' : 'requested' };
    setFound((f) => (f && f.pid === w.pid ? next : f));
    setNear((n) => (n ? { ...n, walkers: n.walkers.map((x) => (x.pid === w.pid ? next : x)) } : n));
    show(state === 'buddies' ? `You and @${w.handle} are now buddies.` : `Asked @${w.handle}.`);
  };

  const accept = async (w: Walker) => {
    const err = await attempt(() => api.accept(w.pid));
    if (err) return show(err);
    const next: Walker = { ...w, relation: 'buddy' };
    setFound((f) => (f && f.pid === w.pid ? next : f));
    setNear((n) => (n ? { ...n, walkers: n.walkers.map((x) => (x.pid === w.pid ? next : x)) } : n));
  };

  const action = (w: Walker) => {
    switch (w.relation) {
      case 'buddy':
        return <Button label="Message" variant="text" compact onPress={() => router.push({ pathname: '/buddies/chat/[key]', params: { key: `b.${w.pid}`, title: w.name ?? `@${w.handle}` } })} />;
      case 'requested':
        return <ThemedText themeColor="onSurfaceVariant">Asked</ThemedText>;
      case 'asked_me':
        return <Button label="Accept" variant="text" compact onPress={() => accept(w)} />;
      case 'self':
        return <ThemedText themeColor="onSurfaceVariant">You</ThemedText>;
      default:
        return <Button label="Ask" variant="text" compact onPress={() => ask(w)} />;
    }
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Find walkers" onBack={back}>
      <Screen title="Find walkers" onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        <TextField label="Walker ID" value={q} onChangeText={setQ} placeholder="Walker ID, e.g. ravi_walks" maxLength={24} plain onSubmit={search} returnKeyType="search" />
        <Button label="Search" icon="search-outline" onPress={search} loading={busy} disabled={!q.trim() || busy} style={styles.gap} />
        {found ? (
          <Surface level={1} style={styles.list}>
            <PersonRow walker={found} trailing={action(found)} last />
          </Surface>
        ) : null}
        {missing ? (
          <ThemedText themeColor="onSurfaceVariant" style={styles.gap}>
            No walker with that ID. Check the spelling, or ask them to open Walk buddies and read out their ID.
          </ThemedText>
        ) : null}
        <SectionTitle>Walkers in your area</SectionTitle>
        {!on ? (
          <Surface level={1} style={styles.note}>
            <ThemedText maxFontSizeMultiplier={1.3}>Show yourself to walkers in your area to see them. Only your area (about 5 km) is used.</ThemedText>
            <Button label="Turn on" variant="text" compact onPress={() => setExplain(true)} loading={nearBusy} disabled={nearBusy || !(me && me.joined)} />
          </Surface>
        ) : (
          <View>
            {near && near.walkers.length ? (
              <Surface level={1} style={styles.list}>
                {near.walkers.map((w, i) => (
                  <PersonRow key={w.pid} walker={w} trailing={action(w)} last={i === near.walkers.length - 1} />
                ))}
              </Surface>
            ) : (
              <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
                {near ? 'No one nearby has turned this on yet.' : '—'}
              </ThemedText>
            )}
            {areaDay ? (
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gap} maxFontSizeMultiplier={1.3}>
                Updated {areaDay}
              </ThemedText>
            ) : null}
            <Button label="Stop showing me" variant="text" compact onPress={turnOff} loading={nearBusy} disabled={nearBusy} style={styles.start} />
          </View>
        )}
        <SectionTitle>Your own ID</SectionTitle>
        <View>
          <ThemedText maxFontSizeMultiplier={1.3}>{me && me.joined ? `@${me.handle}` : '—'}</ThemedText>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            Share it with people you walk with so they can find you.
          </ThemedText>
        </View>
        <Dialog
          visible={explain}
          title="Show me to walkers nearby"
          message="Steps works out your area (about 5 km across) on this phone and sends only that area code. Nobody sees where you are, how far away you are, or your route."
          confirmLabel="Continue"
          cancelLabel="Not now"
          onConfirm={turnOn}
          onCancel={() => setExplain(false)}
        />
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden', marginTop: Spacing.three },
  gap: { marginTop: Spacing.three },
  note: { padding: Spacing.three, gap: Spacing.two, alignItems: 'flex-start' },
  start: { alignSelf: 'flex-start', marginTop: Spacing.two },
});
