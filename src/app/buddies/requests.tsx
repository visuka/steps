import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ClubRow } from '@/components/buddies/clubs/club-parts';
import { PersonRow, SectionTitle, useSnack } from '@/components/buddies/parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, Snackbar, Surface } from '@/components/ui';
import { clubErrorText, isConsentError, joinOrAccept } from '@/buddies/clubs';
import type { ClubCard } from '@/buddies/types';
import { attempt, useLoad, useSocialApi } from '@/buddies/use-buddies';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

/** Who asked me (Accept / Decline), who I asked (Cancel), and clubs that invited me (Join / Decline). */
export default function Requests() {
  const router = useRouter();
  const api = useSocialApi();
  const { data, error, refresh } = useLoad(api.requests);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const act = async (action: () => Promise<void>, done?: string) => {
    const err = await attempt(action);
    show(err ?? done ?? null);
    await refresh();
  };

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const clubInvites = data?.clubInvites ?? [];

  // A club with shared goals shows its goals consent first; nothing is sent until Join there.
  const joinClub = async (c: ClubCard) => {
    const consent = () => router.push({ pathname: '/buddies/club/[id]/join', params: { id: c.clubId } } as never);
    if (c.goals) return consent();
    try {
      await joinOrAccept(api, c);
      show(`You're in ${c.name}.`);
    } catch (e) {
      // The captain turned goals on since this list loaded: the consent comes first.
      if (isConsentError(e)) return consent();
      show(clubErrorText(e));
    }
    await refresh();
  };
  const declineClub = async (c: ClubCard) => {
    try {
      await api.declineClubInvite(c.clubId);
    } catch (e) {
      show(clubErrorText(e));
    }
    await refresh();
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Requests" onBack={back}>
      <Screen title="Requests" onBack={back} onRefresh={refresh} refreshing={false} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {error ? <ThemedText themeColor="onSurfaceVariant">{error}</ThemedText> : null}
        {data && !incoming.length && !outgoing.length && !clubInvites.length ? <EmptyState icon="notifications-outline" title="No requests" hint="When someone asks to be your buddy, it shows here." /> : null}
        {incoming.length ? (
          <>
            <SectionTitle>Asked you</SectionTitle>
            <Surface level={1} style={styles.list}>
              {incoming.map((r, i) => (
                // The buttons sit under the name, so a long walker ID stays on one line.
                <View key={r.walker.pid}>
                  <PersonRow walker={r.walker} last={i === incoming.length - 1} />
                  <View style={styles.actions}>
                    <Button label="Decline" variant="text" compact onPress={() => act(() => api.decline(r.walker.pid))} />
                    <Button label="Accept" variant="text" compact onPress={() => act(() => api.accept(r.walker.pid), `You and @${r.walker.handle} are now buddies.`)} />
                  </View>
                </View>
              ))}
            </Surface>
          </>
        ) : null}
        {outgoing.length ? (
          <>
            <SectionTitle>You asked</SectionTitle>
            <Surface level={1} style={styles.list}>
              {outgoing.map((r, i) => (
                <PersonRow
                  key={r.walker.pid}
                  walker={r.walker}
                  last={i === outgoing.length - 1}
                  trailing={<Button label="Cancel" variant="text" compact onPress={() => act(() => api.cancel(r.walker.pid))} />}
                />
              ))}
            </Surface>
            <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.note} maxFontSizeMultiplier={1.3}>
              Up to 3 at a time. Requests end after 30 days.
            </ThemedText>
          </>
        ) : null}
        {clubInvites.length ? (
          <>
            <SectionTitle>Club invites</SectionTitle>
            <Surface level={1} style={styles.list}>
              {clubInvites.map((r) => (
                <View key={r.club.clubId}>
                  <ClubRow club={r.club} hideState onPress={() => router.push({ pathname: '/buddies/club/[id]', params: { id: r.club.clubId } } as never)} />
                  <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.by} maxFontSizeMultiplier={1.3}>
                    {`Invited by @${r.by.handle}${r.club.goals ? ' · Shared goals' : ''}`}
                  </ThemedText>
                  <View style={styles.actions}>
                    <Button label="Decline" variant="text" compact onPress={() => declineClub(r.club)} />
                    <Button label="Join" variant="text" compact onPress={() => joinClub(r.club)} />
                  </View>
                </View>
              ))}
            </Surface>
          </>
        ) : null}
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two, marginTop: -Spacing.two },
  note: { marginTop: Spacing.two },
  by: { paddingHorizontal: Spacing.three, marginTop: -Spacing.two, marginBottom: Spacing.three },
});
