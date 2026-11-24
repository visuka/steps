/**
 * Your clubs while Buddies is locked (premium ended): each club I am in, with
 * Leave club and, for a club with shared goals, Stop goal tracking. Both stay
 * free on the server, so a member can always take back their goals consent.
 * Plain tiles look: colours and sizes come from the plain tokens and scaled() only.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Btn, Label, Note, plainStyles as ps, Tile, Words } from '@/components/plain/plain-kit';
import { Dialog } from '@/components/ui';
import { cardRole, clubLine, ROLE_WORD } from '@/buddies/clubs';
import type { ClubCard } from '@/buddies/types';
import { useLockedClubs } from '@/buddies/use-clubs';
import { scaled } from '@/constants/ui-scale';

import { STOP_TRACKING, STOP_TRACKING_WHY } from '../goals/goals-tab';

const S = scaled;

type Ask = { kind: 'leave' | 'goals'; club: ClubCard };

/**
 * The tile; `only` keeps one club (the club screen while locked). Shows nothing
 * when I am in no club (or not yet in Walk buddies). `show` is the screen's snackbar.
 */
export function LockedClubs({ only, show }: { only?: string; show: (m: string | null) => void }) {
  const c = useLockedClubs();
  const [ask, setAsk] = useState<Ask | null>(null);
  const clubs = (c.clubs ?? []).filter((x) => !only || x.clubId === only);
  if (!clubs.length) return null;

  const confirm = async () => {
    const a = ask;
    setAsk(null);
    if (!a) return;
    if (a.kind === 'leave') show((await c.leave(a.club.clubId)) ?? `You left ${a.club.name}.`);
    else show((await c.stopTracking(a.club.clubId)) ?? 'Goal tracking is off.');
  };

  return (
    <Tile>
      <Label icon="people" text="Your clubs" />
      <Note style={{ marginTop: S(8) }}>Without Premium you can still leave a club or stop goal tracking.</Note>
      {clubs.map((club) => {
        const role = cardRole(club);
        const line = [role ? ROLE_WORD[role] : null, clubLine(club)].filter(Boolean).join(' · ');
        const busy = c.busy === `leave/${club.clubId}` || c.busy === `goals/${club.clubId}`;
        return (
          <View key={club.clubId} style={styles.club} accessibilityState={{ busy }}>
            <View accessible accessibilityLabel={`${club.name}, ${line}`}>
              <Words size={15} weight={600} line={19} lines={2}>
                {club.name}
              </Words>
              <Note lines={2}>{line}</Note>
            </View>
            <View style={[ps.row, styles.actions]}>
              {club.goals ? (
                <Btn text="Stop goal tracking" onPress={() => !busy && setAsk({ kind: 'goals', club })} label={`Stop goal tracking in ${club.name}`} />
              ) : null}
              {/* The captain hands the club over or deletes it in the club itself, as with Premium. */}
              {role !== 'owner' ? <Btn text="Leave club" onPress={() => !busy && setAsk({ kind: 'leave', club })} label={`Leave ${club.name}`} /> : null}
            </View>
          </View>
        );
      })}
      <Dialog
        visible={ask?.kind === 'leave'}
        title={`Leave ${ask?.club.name ?? 'the club'}?`}
        message="You leave the club chat and the board. If the club has shared goals, your goal history here is deleted."
        confirmLabel="Leave"
        danger
        onCancel={() => setAsk(null)}
        onConfirm={() => void confirm()}
      />
      <Dialog
        visible={ask?.kind === 'goals'}
        title={STOP_TRACKING}
        message={STOP_TRACKING_WHY}
        confirmLabel="Stop tracking"
        onCancel={() => setAsk(null)}
        onConfirm={() => void confirm()}
      />
    </Tile>
  );
}

const styles = StyleSheet.create({
  club: { marginTop: S(14) },
  actions: { flexWrap: 'wrap', marginTop: S(10), rowGap: S(12) },
});
