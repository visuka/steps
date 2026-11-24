/**
 * Buddies home, Groups (spec T16f): the clubs I am in, Find a club and
 * Start a club, in the plain tiles look. Planned walks has its own slot
 * under it, filled by the next stage (walk plans). Colours and sizes come
 * from the plain tokens and scaled() only.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Btn, Caps, Label, Note, plainStyles as ps, Tile, Words } from '@/components/plain/plain-kit';
import { PLAIN } from '@/components/plain/plain-theme';
import { clubLine } from '@/buddies/clubs';
import type { ClubCard } from '@/buddies/types';
import { scaled } from '@/constants/ui-scale';

const S = scaled;

export function GroupsTile({
  clubs,
  error,
  asking,
  onOpen,
  onFind,
  onStart,
}: {
  /** Null while loading. */
  clubs: ClubCard[] | null;
  error: string | null;
  /** Walkers asking to join the clubs I run. */
  asking: number;
  onOpen: (c: ClubCard) => void;
  onFind: () => void;
  onStart: () => void;
}) {
  return (
    <Tile>
      <View style={ps.spread}>
        <Label icon="people" text="Clubs" />
        {asking ? <Caps text={`${asking} asking to join`} /> : null}
      </View>
      {clubs && clubs.length === 0 ? (
        <Note style={{ marginTop: S(8) }}>Walk with a group. Find a club near you, or start your own.</Note>
      ) : (
        (clubs ?? []).map((c) => <ClubLine key={c.clubId} c={c} onPress={() => onOpen(c)} />)
      )}
      {!clubs && !error ? <Note style={{ marginTop: S(8) }}>—</Note> : null}
      {error ? <Note style={{ marginTop: S(8) }}>{error}</Note> : null}
      <View style={[ps.footRow, { gap: S(8) }]}>
        <Btn text="Find a club" kind="main" onPress={onFind} />
        <Btn text="Start a club" onPress={onStart} />
      </View>
    </Tile>
  );
}

/**
 * The place for planned walks (the next stage swaps this part for the real
 * list). It promises nothing it can't do yet.
 */
export function PlannedWalksSlot() {
  return (
    <Tile style={[ps.spread, { paddingTop: S(12), paddingBottom: S(12) }]}>
      <Label icon="walk" text="Planned walks" />
      <Note style={{ marginTop: 0 }} lines={1}>
        Coming soon
      </Note>
    </Tile>
  );
}

/** One club: the initial, the name over "area · members", and where I stand. */
function ClubLine({ c, onPress }: { c: ClubCard; onPress: () => void }) {
  const line = clubLine(c);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${line}`}
      android_ripple={{ color: PLAIN.ripple }}
      style={[ps.row, styles.line]}>
      <View style={styles.av}>
        <Words size={15} weight={600} line={18}>
          {c.name.trim().charAt(0).toUpperCase() || '?'}
        </Words>
      </View>
      <View style={styles.text}>
        <Words size={15} weight={600} line={19} lines={1}>
          {c.name}
        </Words>
        <Note lines={1}>{line}</Note>
      </View>
      {c.myState !== 'member' ? <Note style={{ marginTop: 0 }}>{c.myState === 'asked' ? 'Asked' : 'Invited'}</Note> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { paddingVertical: S(8), minHeight: 48 },
  text: { flex: 1, minWidth: 0 },
  av: { width: S(40), height: S(40), borderRadius: S(20), backgroundColor: PLAIN.chip, alignItems: 'center', justifyContent: 'center' },
});
