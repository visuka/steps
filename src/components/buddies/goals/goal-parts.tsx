/**
 * Shared club goals, the pieces the goal screens share: the kind icon, my
 * goal row (what the phone counted today, and a small Log button for what
 * the person logs), a captain's goal row, and the goal tracking switch with
 * what it shares. Theme roles, Spacing and TouchTarget only; numbers and
 * words, no bars or rings. Wording stays neutral: "Not marked yet", never missed.
 */
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ListRow, Surface, ToggleRow } from '@/components/ui';
import { PlainIcon } from '@/components/plain/plain-icons';
import { type PhoneToday, statusWords } from '@/buddies/goals-auto';
import { byWords, countedWord, goalLine, isLogged, KIND_ICON, LOG_ROUTE, summaryLine } from '@/buddies/goals';
import type { Goal, GoalKind, GoalMark, GoalSummaryRow } from '@/buddies/types';
import { Spacing, TouchTarget } from '@/constants/theme';
import type { Units } from '@/lib/format';
import type { ClockStyle } from '@/lib/when';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/state/app-state';

import { CONSENT_NEVER, CONSENT_SEE, ShareList } from '../clubs/club-parts';
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

/**
 * What my row says about a goal today: done, the phone's count, or not marked
 * yet; an "at most" goal the phone now sees over says so at once (goals-auto.ts statusWords).
 */
export function myStatus(goal: Goal, mark: GoalMark | null, phone: PhoneToday | null, clock: ClockStyle, units: Units = 'metric'): string {
  return statusWords(goal, mark, phone, clock, units);
}

/** The small line under a goal's name: "by 7:00 am · Counted by the phone". */
function myLine(goal: Goal, clock: ClockStyle): string {
  const parts: string[] = [];
  // "by 7:00 am" wraps as one unit.
  if (goal.byTime) parts.push(byWords(goal.byTime, clock));
  parts.push(countedWord(goal.kind));
  return parts.join(' · ');
}

/** Opens the app's own place to log a kind (blood pressure, weight, mood, food, water). */
export function useOpenLog() {
  const router = useRouter();
  return useCallback(
    (kind: GoalKind) => {
      const to = LOG_ROUTE[kind];
      if (!to) return;
      // A fresh n re-selects the Activity part when that tab is already open.
      router.push((to.params ? { pathname: to.pathname, params: { ...to.params, n: String(Date.now()) } } : to.pathname) as never);
    },
    [router],
  );
}

/** The small Log button of a logged kind; nothing for a kind the phone counts by itself. */
export function LogButton({ goal }: { goal: Pick<Goal, 'kind' | 'title'> }) {
  const openLog = useOpenLog();
  if (!isLogged(goal.kind)) return null;
  // The shared small pill: 40 dp to see, 48 dp to hit (BUTTON_STYLE.slim), so it sits inside the row.
  return <Button label="Log" variant="tonal" compact slim onPress={() => openLog(goal.kind)} accessibilityLabel={`Log for ${goal.title}`} />;
}

/**
 * One of my goals for today: icon, name, by-time, then the status. The phone
 * marks every goal from its own numbers; a goal counted from what I log has
 * a small Log button that opens where I log it.
 */
export function MyGoalRow({
  goal,
  mark,
  phone,
  clock,
  first,
}: {
  goal: Goal;
  mark: GoalMark | null;
  phone: PhoneToday | null;
  clock: ClockStyle;
  first?: boolean;
}) {
  const theme = useTheme();
  const { profile } = useApp();
  const status = myStatus(goal, mark, phone, clock, profile.units);
  const line = myLine(goal, clock);
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
        </View>
        {/* The status, and Log beside it, so no button floats on a line of its own. */}
        <View style={styles.statusRow}>
          <ThemedText type="titleSmall" style={styles.statusText} maxFontSizeMultiplier={1.3} importantForAccessibility="no" accessibilityElementsHidden>
            {status}
          </ThemedText>
          <LogButton goal={goal} />
        </View>
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
  const { profile } = useApp();
  const line = goalLine(goal, clock, profile.units);
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
          <ShareList title="They never see" rows={CONSENT_NEVER} never />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, minHeight: TouchTarget, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  grow: { flex: 1, minWidth: 0 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginTop: Spacing.one },
  statusText: { flexShrink: 1 },
  list: { overflow: 'hidden' },
  title: { marginTop: Spacing.three, marginBottom: Spacing.two },
  titleFirst: { marginBottom: Spacing.two },
  note: { marginTop: Spacing.two },
  share: { marginTop: Spacing.three, gap: Spacing.three },
});
