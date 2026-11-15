import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PersonRow, SectionTitle, useSnack } from '@/components/buddies/parts';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Screen, Snackbar, Surface } from '@/components/ui';
import { cleanHandle, handleProblem } from '@/buddies/chat-logic';
import { SocialError } from '@/buddies/read';
import type { Walker } from '@/buddies/types';
import { attempt, useSocialApi, useSocialMe } from '@/buddies/use-buddies';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

/** Find a walker by their ID, then ask them to be buddies. */
export default function FindWalkers() {
  const router = useRouter();
  const api = useSocialApi();
  const { me } = useSocialMe();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Walker | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const search = async () => {
    const h = cleanHandle(q);
    const problem = handleProblem(h);
    if (problem) return show(problem);
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

  const ask = async (w: Walker) => {
    const box: { state: 'requested' | 'buddies' } = { state: 'requested' };
    const err = await attempt(async () => {
      box.state = await api.ask(w.pid);
    });
    if (err) return show(err);
    const state = box.state;
    setFound({ ...w, relation: state === 'buddies' ? 'buddy' : 'requested' });
    show(state === 'buddies' ? `You and @${w.handle} are now buddies.` : `Asked @${w.handle}.`);
  };

  const accept = async (w: Walker) => {
    const err = await attempt(() => api.accept(w.pid));
    if (err) return show(err);
    setFound({ ...w, relation: 'buddy' });
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
        <TextField label="Walker ID" value={q} onChangeText={setQ} placeholder="Walker ID, e.g. ravi_walks" maxLength={21} onEndEditing={undefined} />
        <Button label="Search" icon="search-outline" onPress={search} loading={busy} disabled={!q.trim() || busy} style={styles.gap} />
        {found ? (
          <Surface level={1} style={styles.list}>
            <PersonRow walker={found} trailing={action(found)} last />
          </Surface>
        ) : null}
        {missing ? (
          <ThemedText themeColor="onSurfaceVariant" style={styles.gap}>
            No walker with that ID.
          </ThemedText>
        ) : null}
        <SectionTitle>Your own ID</SectionTitle>
        <View>
          <ThemedText maxFontSizeMultiplier={1.3}>{me && me.joined ? `@${me.handle}` : '—'}</ThemedText>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            Share it with people you walk with so they can find you.
          </ThemedText>
        </View>
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden', marginTop: Spacing.three },
  gap: { marginTop: Spacing.three },
});
