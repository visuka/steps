/**
 * Shared club goals, the pieces the goal screens share: the kind icon, my
 * goal row (Mark done / Undo, or what the phone counted), a captain's goal
 * row, and the goal tracking switch with what it shares. Theme roles,
 * Spacing and TouchTarget only; numbers and words, no bars or rings.
 * Wording stays neutral: "Not marked yet", never missed.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ListRow, Surface, ToggleRow } from '@/components/ui';
import { PlainIcon } from '@/components/plain/plain-icons';
import { autoDecision, type PhoneToday } from '@/buddies/goals-auto';
import { byTimeWords, countedWord, goalLine, KIND_ICON, KIND_WORD, liveWords, markWords, summaryLine } from '@/buddies/goals';
import type { Goal, GoalMark, GoalSummaryRow } from '@/buddies/types';
import { Spacing, TouchTarget } from '@/constants/theme';
import type { ClockStyle } from '@/lib/when';
import { useTheme } from '@/hooks/use-theme';

import { CONSENT_NEVER, CONSENT_SEE } from '../clubs/club-parts';
import { AVATAR } from '../parts';

const BADGE = AVATAR;

/** The kind's icon in a soft circle (hidden from screen readers; the row says the kind). */
export function KindBadge({ kind }: { kind: Goal['kind'] }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.secondaryContainer }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PlainIcon name={KIND_ICON[kind]} size={20} />
    </View>
  );
}

/** What my row says about a goal today: done, the phone's count, or not marked yet. */
export function myStatus(goal: Goal, mark: GoalMark | null, phone: PhoneToday | null, clock: ClockStyle): string {
  if (mark?.done) return markWords(mark, clock);
  if (goal.counted === 'auto' && goal.target !== null) {
    const d = phone ? autoDecision(goal, phone) : null;
    // The phone's own number when it has one; else what was last sent.
    const value = d?.value ?? mark?.value ?? null;
    if (value !== null) return liveWords(goal.kind, value, goal.target);
  }
  return markWords(null, clock);
}

/** The small line under a goal's name: "by 7:00 am · Counted by the phone". */
function myLine(goal: Goal, clock: ClockStyle): string {
  const parts: string[] = [];
  if (goal.byTime) parts.push(`by ${byTimeWords(goal.byTime, clock)}`);
  parts.push(goal.counted === 'auto' ? countedWord('auto') : KIND_WORD[goal.kind]);
  return parts.join(' · ');
}

/**
 * One of my goals for today: icon, name, by-time, then the status. A tap
 * goal has Mark done, or Undo once done; the phone marks an auto goal.
 */
export function MyGoalRow({
  goal,
  mark,
  phone,
  clock,
  busy,
  onMark,
  first,
}: {
  goal: Goal;
  mark: GoalMark | null;
  phone: PhoneToday | null;
  clock: ClockStyle;
  busy: boolean;
  onMark: (done: boolean) => void;
  first?: boolean;
}) {
  const theme = useTheme();
  const status = myStatus(goal, mark, phone, clock);
  const line = myLine(goal, clock);
  const done = !!mark?.done;
  return (
    <View style={[styles.row, first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.outlineVariant }]}>
      <KindBadge kind={goal.kind} />
      <View style={styles.grow}>
        <View accessible accessibilityLabel={`${goal.title}, ${line}, ${status}`}>
          <ThemedText numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {goal.title}
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {line}
          </ThemedText>
          <ThemedText type="titleSmall" style={styles.status} maxFontSizeMultiplier={1.3}>
            {status}
          </ThemedText>
        </View>
        {goal.counted === 'tap' ? (
          <View style={styles.action}>
            {done ? (
              <Button
                label="Undo"
                variant="text"
                compact
                loading={busy}
                disabled={busy}
                onPress={() => onMark(false)}
                accessibilityLabel={`Undo ${goal.title}`}
              />
            ) : (
              <Button
                label="Mark done"
                variant="tonal"
                compact
                loading={busy}
                disabled={busy}
                onPress={() => onMark(true)}
                accessibilityLabel={`Mark ${goal.title} done`}
              />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A goal for the captain: name over "target · days · by-time", "9 of 12 done" on the right; opens the goal. */
export function StaffGoalRow({
  goal,
  summary,
  clock,
  onPress,
  last,
}: {
  goal: Goal;
  summary: GoalSummaryRow | undefined;
  clock: ClockStyle;
  onPress: () => void;
  last?: boolean;
}) {
  const line = goalLine(goal, clock);
  const done = goal.paused ? 'Paused' : summaryLine(summary);
  return (
    <ListRow
      title={goal.title}
      supporting={line}
      leading={<KindBadge kind={goal.kind} />}
      trailingText={goal.paused ? undefined : done}
      chevron
      onPress={onPress}
      accessibilityLabel={`${goal.title}, ${line}, ${done}`}
      accessibilityHint="Opens who did it today and this week"
      last={last}
    />
  );
}

/** A short heading over a group of rows. */
export function GroupTitle({ title, first }: { title: string; first?: boolean }) {
  return (
    <ThemedText type="titleSmall" themeColor="onSurfaceVariant" style={first ? styles.titleFirst : styles.title} maxFontSizeMultiplier={1.3}>
      {title}
    </ThemedText>
  );
}

/** A muted line under a group. */
export function GoalNote({ text }: { text: string }) {
  return (
    <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.note} maxFontSizeMultiplier={1.3}>
      {text}
    </ThemedText>
  );
}

/**
 * Goal tracking in one club, for a member who joined before goals were on
 * (or turned it off): what it shares, and the switch. Off again takes my
 * marks away (the caller confirms first).
 */
export function TrackingSwitch({ on, busy, onChange, clubName }: { on: boolean; busy: boolean; onChange: (on: boolean) => void; clubName?: string }) {
  return (
    <View>
      <Surface level={1} style={styles.list}>
        <ToggleRow
          title="Track my goals here"
          supporting={clubName ?? (on ? 'The captain and vice-captains see done or not done' : 'Off: no one sees your goals here')}
          value={on}
          onValueChange={onChange}
          disabled={busy}
        />
      </Surface>
      {on ? null : (
        <View style={styles.share}>
          <ShareList title="When on, the captain and vice-captains see" rows={CONSENT_SEE} />
          <ShareList title="They never see" rows={CONSENT_NEVER} />
        </View>
      )}
    </View>
  );
}

function ShareList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <View style={styles.shareGroup}>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        {title}
      </ThemedText>
      {rows.map((r) => (
        <ThemedText key={r} type="bodySmall" maxFontSizeMultiplier={1.3}>
          {r}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, minHeight: TouchTarget, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  grow: { flex: 1, minWidth: 0 },
  status: { marginTop: Spacing.one },
  action: { marginTop: Spacing.two, alignItems: 'flex-start' },
  list: { overflow: 'hidden' },
  title: { marginTop: Spacing.four, marginBottom: Spacing.two },
  titleFirst: { marginBottom: Spacing.two },
  note: { marginTop: Spacing.two },
  share: { marginTop: Spacing.three, gap: Spacing.three },
  shareGroup: { gap: Spacing.half },
});
