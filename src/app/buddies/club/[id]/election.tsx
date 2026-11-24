import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PersonRow, SectionTitle, useSnack } from '@/components/buddies/parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, Snackbar, Surface, ToggleRow } from '@/components/ui';
import {
  actingWords,
  candidateLine,
  candidateOrder,
  endsWords,
  HOW_IT_WORKS,
  lastElectionWords,
  myPidOf,
  noOneStandsWords,
  standNote,
  voteDoneWords,
  voteWord,
} from '@/buddies/election';
import { displayName } from '@/buddies/read';
import { useClub } from '@/buddies/use-clubs';
import { Spacing } from '@/constants/theme';
import { useClock } from '@/hooks/use-clock';
import { useClockStyle } from '@/hooks/use-clock-style';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Choosing a new captain (owner, 24 Nov 2026): the captain left, so for 2
 * days members vote. Who acts as captain meanwhile, how it works, Stand for
 * captain, and the people standing with Vote / Your vote. Ballots
 * are secret: no counts, only the result once it closes. Neutral words.
 */
export default function ClubElectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useClub(id);
  const now = useClock().now;
  const clock = useClockStyle();
  const { snack, show, dismiss } = useSnack();
  const [busy, setBusy] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const e = c.election;
  const myPid = myPidOf(c.members);
  const result = lastElectionWords(c.lastElection, now, myPid);
  const acting = e ? actingWords(e, c.members, myPid) : null;
  const list = e ? candidateOrder(e.candidates) : [];

  const act = async (key: string, action: () => Promise<string | null>, done: string) => {
    setBusy(key);
    const err = await action();
    setBusy(null);
    show(err ?? done);
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="New captain" onBack={back}>
      <Screen
        title="New captain"
        subtitle={c.club?.name}
        onBack={back}
        onRefresh={c.refresh}
        refreshing={false}
        overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {c.error ? (
          <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {c.error}
          </ThemedText>
        ) : null}
        {!c.club ? null : !e ? (
          // Closed (or never opened): the result while it is new, else a plain line.
          <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {result ?? 'Voting for a captain has ended.'}
          </ThemedText>
        ) : (
          <>
            <View style={styles.lines}>
              <ThemedText maxFontSizeMultiplier={1.3}>{`Voting ends ${endsWords(e.endsAt, now, clock)}.`}</ThemedText>
              {acting ? (
                <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
                  {acting}
                </ThemedText>
              ) : null}
            </View>

            <SectionTitle icon="list">How it works</SectionTitle>
            <Surface level={1} style={styles.how}>
              {HOW_IT_WORKS.map((line) => (
                <ThemedText key={line} type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
                  {line}
                </ThemedText>
              ))}
            </Surface>

            <Surface level={1} style={styles.list}>
              <ToggleRow
                title="Stand for captain"
                supporting={standNote(e)}
                value={e.iStand}
                disabled={!e.canVote || busy === 'stand'}
                onValueChange={(on) =>
                  act('stand', () => c.stand(on), on ? "You're standing for captain." : "You've withdrawn. Votes for you are cleared.")
                }
              />
            </Surface>

            <SectionTitle icon="people">{list.length ? `Standing · ${list.length}` : 'Standing'}</SectionTitle>
            {list.length ? (
              <Surface level={1} style={styles.list}>
                {list.map((cand, i) => {
                  const word = voteWord(cand.pid, e.myVote);
                  const mine = word === 'Your vote';
                  const who = cand.isMe ? 'yourself' : displayName(cand);
                  return (
                    <PersonRow
                      key={cand.pid}
                      walker={cand}
                      supporting={candidateLine(cand)}
                      last={i === list.length - 1}
                      trailing={
                        e.canVote ? (
                          <Button
                            label={word}
                            variant={mine ? 'tonal' : 'outlined'}
                            compact
                            loading={busy === cand.pid}
                            disabled={!!busy}
                            accessibilityLabel={mine ? `Your vote is for ${who}` : `${word}: vote for ${who}`}
                            onPress={() => (mine ? undefined : act(cand.pid, () => c.vote(cand.pid), voteDoneWords(cand.pid, e.candidates)))}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </Surface>
            ) : (
              <EmptyState
                icon="people-outline"
                title="No one is standing yet"
                hint={noOneStandsWords(e, c.members, myPid)}
              />
            )}
            {e.myVote ? (
              <Button
                label="Clear my vote"
                variant="text"
                compact
                disabled={!!busy}
                style={styles.start}
                onPress={() => act('clear', () => c.vote(null), voteDoneWords(null, e.candidates))}
              />
            ) : null}
          </>
        )}
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  lines: { gap: Spacing.one },
  how: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.two },
  list: { overflow: 'hidden' },
  start: { alignSelf: 'flex-start' },
});
