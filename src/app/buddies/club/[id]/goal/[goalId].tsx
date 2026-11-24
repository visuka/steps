import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { AnswerCounts } from '@/components/buddies/plans/plan-parts';
import { GoalNote, GroupTitle, KindBadge } from '@/components/buddies/goals/goal-parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Dialog, ListRow, Screen, Snackbar, Surface } from '@/components/ui';
import { ROLE_WORD } from '@/buddies/clubs';
import { countedWord, goalLine, weekLine } from '@/buddies/goals';
import { displayName } from '@/buddies/read';
import type { GoalReportRow } from '@/buddies/types';
import { useGoalReport } from '@/buddies/use-goals';
import { Spacing } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';
import { type ClockStyle, formatClock } from '@/lib/when';
import { SCREEN_FEATURES } from '@/premium/premium';

export const REMIND_CAPTION = 'Members choose whether they get reminders.';
export const DELETE_GOAL_WHY = "The goal and everyone's marks for it are deleted. This can't be undone.";

/**
 * One goal, for the captain and vice-captains: today's done and not marked
 * yet with names, this week per member, never done, a gentle reminder, and
 * Edit, Pause and Delete. Numbers and words only; no red.
 */
export default function GoalScreen() {
  const { id, goalId } = useLocalSearchParams<{ id: string; goalId: string }>();
  const router = useRouter();
  const clock = useClockStyle();
  const r = useGoalReport(id, goalId);
  const { snack, show, dismiss } = useSnack();
  const [askDelete, setAskDelete] = useState(false);
  const back = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/buddies/club/[id]', params: { id, seg: 'goals' } } as never);
  const report = r.data;
  const title = report?.goal.title ?? 'Goal';

  const body = !report ? (
    <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
      {r.error ?? '—'}
    </ThemedText>
  ) : (
    <View>
      <View style={styles.head}>
        <KindBadge kind={report.goal.kind} />
        <View style={styles.grow}>
          <ThemedText maxFontSizeMultiplier={1.3}>{goalLine(report.goal, clock)}</ThemedText>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {countedWord(report.goal.counted)}
          </ThemedText>
        </View>
      </View>

      <GroupTitle title="Today" />
      <AnswerCounts
        cells={[
          { n: report.doneToday, word: 'Done' },
          { n: Math.max(0, report.members - report.doneToday), word: 'Not marked yet' },
        ]}
      />
      <People title="Done" rows={report.rows.filter((x) => x.today.done)} clock={clock} today />
      <People title="Not marked yet" rows={report.rows.filter((x) => !x.today.done)} clock={clock} today />

      <GroupTitle title="This week" />
      {report.rows.length ? (
        <Surface level={1} style={styles.list}>
          {report.rows.map((x, i) => (
            <ListRow
              key={x.walker.pid}
              title={nameOf(x)}
              supporting={x.role === 'member' ? undefined : ROLE_WORD[x.role]}
              trailingText={weekLine(x.week)}
              last={i === report.rows.length - 1}
            />
          ))}
        </Surface>
      ) : (
        <GoalNote text="No one is tracking goals in this club yet." />
      )}
      <GoalNote text={`Never done: ${report.neverDone}`} />

      <View style={styles.gapLarge}>
        <Button
          label={r.reminded ? 'Reminder sent' : `Send a gentle reminder to ${r.targets.length}`}
          variant="tonal"
          onPress={async () => show((await r.remind()) ?? 'Reminder sent.')}
          disabled={r.busy || r.reminded || !r.targets.length || report.goal.paused}
        />
        <GoalNote text={REMIND_CAPTION} />
      </View>

      <View style={styles.actions}>
        <Button
          label="Edit"
          variant="secondary"
          raised
          onPress={() => router.push({ pathname: '/buddies/club/[id]/goal/new', params: { id, goal: goalId } } as never)}
          disabled={r.busy}
        />
        <Button
          label={report.goal.paused ? 'Resume' : 'Pause'}
          variant="secondary"
          raised
          onPress={async () => show((await r.setPaused(!report.goal.paused)) ?? (report.goal.paused ? 'Goal resumed.' : 'Goal paused.'))}
          disabled={r.busy}
        />
        <Button label="Delete" variant="text" onPress={() => setAskDelete(true)} disabled={r.busy} />
      </View>
      {report.goal.paused ? <GoalNote text="Paused: members don't see it today and nothing is marked." /> : null}
    </View>
  );

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
      <Screen
        title={title}
        onBack={back}
        overlay={
          <>
            <Snackbar message={snack} onDismiss={dismiss} />
            <Dialog
              visible={askDelete}
              title="Delete this goal?"
              message={DELETE_GOAL_WHY}
              confirmLabel="Delete"
              onCancel={() => setAskDelete(false)}
              onConfirm={async () => {
                setAskDelete(false);
                const err = await r.remove();
                if (err) return show(err);
                back();
              }}
            />
          </>
        }>
        {body}
      </Screen>
    </PremiumGate>
  );
}

const nameOf = (x: GoalReportRow) => (x.walker.relation === 'self' ? 'You' : displayName(x.walker));

function People({ title, rows, clock, today }: { title: string; rows: GoalReportRow[]; clock: ClockStyle; today?: boolean }) {
  if (!rows.length) return null;
  return (
    <View>
      <GroupTitle title={`${title} (${rows.length})`} />
      <Surface level={1} style={styles.list}>
        {rows.map((x, i) => (
          <ListRow
            key={x.walker.pid}
            title={nameOf(x)}
            supporting={x.walker.name ? `@${x.walker.handle}` : undefined}
            trailingText={today && x.today.done && x.today.at ? formatClock(x.today.at, clock) : undefined}
            last={i === rows.length - 1}
          />
        ))}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grow: { flex: 1, minWidth: 0 },
  list: { overflow: 'hidden' },
  gapLarge: { marginTop: Spacing.four },
  actions: { marginTop: Spacing.four, gap: Spacing.two },
});
