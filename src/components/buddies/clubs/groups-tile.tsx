/**
 * Buddies home, Groups (spec T16f): the clubs I am in (my role on the right,
 * and for a club with shared goals one goal line), Find a club and Start a
 * club, in the plain tiles look. Planned walks is its own tile
 * under it (plans/planned-walks-tile.tsx). Colours and sizes come from the
 * plain tokens and scaled() only.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Btn, Caps, Label, Note, plainStyles as ps, Tile, Words } from '@/components/plain/plain-kit';
import { PLAIN } from '@/components/plain/plain-theme';
import { clubLine, standWordOf } from '@/buddies/clubs';
import type { ClubCard } from '@/buddies/types';
import { scaled } from '@/constants/ui-scale';

const S = scaled;

export function GroupsTile({
  clubs,
  error,
  asking,
  goalLines,
  onOpen,
  onFind,
  onStart,
}: {
  /** Null while loading. */
  clubs: ClubCard[] | null;
  error: string | null;
  /** Walkers asking to join the clubs I run. */
  asking: number;
  /** A club's goal line by clubId ("1 of 3 goals done today"); missing or null shows none. */
  goalLines?: Record<string, string | null>;
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
        (clubs ?? []).map((c) => <ClubLine key={c.clubId} c={c} goal={goalLines?.[c.clubId] ?? null} onPress={() => onOpen(c)} />)
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

/** One club: the initial, the name over "area · members" and its goal line, and my role or where I stand. */
function ClubLine({ c, goal, onPress }: { c: ClubCard; goal: string | null; onPress: () => void }) {
  const line = clubLine(c);
  const stand = standWordOf(c);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[c.name, line, goal, stand].filter(Boolean).join(', ')}
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
        {goal ? <Note lines={1}>{goal}</Note> : null}
      </View>
      {stand ? <Note style={{ marginTop: 0 }}>{stand}</Note> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { paddingVertical: S(8), minHeight: 48 },
  text: { flex: 1, minWidth: 0 },
  av: { width: S(40), height: S(40), borderRadius: S(20), backgroundColor: PLAIN.chip, alignItems: 'center', justifyContent: 'center' },
});
