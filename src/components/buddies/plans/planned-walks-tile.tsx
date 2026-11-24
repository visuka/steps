/**
 * Buddies home, Groups: Planned walks (T16e). The walks I made, was invited
 * to, or my clubs planned, soonest first, and Plan a walk. Words and numbers
 * only, in the plain tiles look: colours and sizes come from the plain tokens
 * and scaled() only.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Btn, Label, Note, plainStyles as ps, Tile, Words } from '@/components/plain/plain-kit';
import { PLAIN } from '@/components/plain/plain-theme';
import { planLine, standWord } from '@/buddies/plans';
import type { Plan } from '@/buddies/types';
import { TouchTarget } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';
import type { ClockStyle } from '@/lib/when';

const S = scaled;

export function PlannedWalksTile({
  plans,
  error,
  now,
  clock,
  onOpen,
  onPlan,
}: {
  /** Null while loading. */
  plans: Plan[] | null;
  error: string | null;
  now: number;
  clock: ClockStyle;
  onOpen: (p: Plan) => void;
  onPlan: () => void;
}) {
  return (
    <Tile>
      <Label icon="walk" text="Planned walks" />
      {plans && plans.length === 0 ? (
        <Note style={{ marginTop: S(8) }}>Pick a time and a meeting place, and invite buddies or a club.</Note>
      ) : (
        (plans ?? []).map((p) => <PlanLine key={p.planId} p={p} line={planLine(p, now, clock)} onPress={() => onOpen(p)} />)
      )}
      {!plans && !error ? <Note style={{ marginTop: S(8) }}>—</Note> : null}
      {error ? <Note style={{ marginTop: S(8) }}>{error}</Note> : null}
      <View style={[ps.footRow, { gap: S(8) }]}>
        <Btn text="Plan a walk" kind="main" onPress={onPlan} />
      </View>
    </Tile>
  );
}

/** One plan: the place over "day, time · going", and where I stand. */
function PlanLine({ p, line, onPress }: { p: Plan; line: string; onPress: () => void }) {
  const stand = standWord(p);
  const where = p.club ? `${p.place}, ${p.club.name}` : p.place;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[where, line, stand].filter(Boolean).join(', ')}
      android_ripple={{ color: PLAIN.ripple }}
      style={[ps.row, styles.line]}>
      <View style={styles.text}>
        <Words size={15} weight={600} line={19} lines={1}>
          {p.place}
        </Words>
        <Note lines={1}>{p.club ? `${line} · ${p.club.name}` : line}</Note>
      </View>
      {stand ? <Note style={{ marginTop: 0 }}>{stand}</Note> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The touch floor stays 48 dp at every scale.
  line: { paddingVertical: S(8), minHeight: TouchTarget },
  text: { flex: 1, minWidth: 0 },
});
