/**
 * A club's Goals tab. Every tracked member sees today's goals that apply to
 * them (the phone's count, and Log for what they log). The captain and
 * vice-captains also see each goal's "9 of 12 done", New goal, and open a
 * goal for who did it. A member who joined before goals were on gets the
 * tracking switch; turning it on first shows the goals consent, and only its
 * Turn on tracking sends anything. Theme roles and Spacing only; no red, neutral words.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Dialog, EmptyState, Surface } from '@/components/ui';
import { dueOn, GOALS_MAX } from '@/buddies/goals';
import type { Club } from '@/buddies/types';
import { useClubGoals } from '@/buddies/use-goals';
import { Spacing } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';

import { GoalsConsent } from '../clubs/club-parts';
import { GoalNote, GroupTitle, MyGoalRow, StaffGoalRow, TrackingSwitch } from './goal-parts';

export const STOP_TRACKING = 'Stop tracking goals here?';
export const STOP_TRACKING_WHY = 'Your goal history in this club is deleted. You can turn it on again later.';

export function GoalsTabBody({ club, show }: { club: Club; show: (m: string | null) => void }) {
  const router = useRouter();
  const clock = useClockStyle();
  const g = useClubGoals(club);
  const [stopAsk, setStopAsk] = useState(false);
  // The goals consent, opened by the tracking switch; only its button turns tracking on.
  const [consentAsk, setConsentAsk] = useState(false);
  const data = g.data;

  if (!club.goals) {
    return <EmptyState icon="checkbox-outline" title="No shared goals" hint="The captain can turn on shared goals in Edit club." />;
  }
  if (!data) {
    return g.error ? (
      <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        {g.error}
      </ThemedText>
    ) : null;
  }

  const due = data.goals.filter((x) => dueOn(x, g.today));
  const later = data.goals.length - due.length;
  const openGoal = (goalId: string) => router.push({ pathname: '/buddies/club/[id]/goal/[goalId]', params: { id: club.clubId, goalId } } as never);
  const newGoal = () => router.push({ pathname: '/buddies/club/[id]/goal/new', params: { id: club.clubId } } as never);
  const consent = async (on: boolean) => {
    const err = await g.setConsent(on);
    if (on && !err) setConsentAsk(false);
    show(err ?? (on ? 'Goal tracking is on.' : 'Goal tracking is off.'));
  };

  return (
    <View>
      {data.tracked ? (
        <>
          <GroupTitle title="Today" first />
          {due.length ? (
            <Surface level={1} style={styles.list}>
              {due.map((goal, i) => (
                <MyGoalRow
                  key={goal.goalId}
                  goal={goal}
                  mark={data.mine.find((m) => m.goalId === goal.goalId) ?? null}
                  phone={g.phone}
                  clock={clock}
                  first={i === 0}
                />
              ))}
            </Surface>
          ) : (
            <GoalNote text={data.goals.length ? 'No goals for today.' : 'No goals yet.'} />
          )}
          {later > 0 && due.length ? <GoalNote text={later === 1 ? '1 more goal on other days.' : `${later} more goals on other days.`} /> : null}
        </>
      ) : consentAsk ? (
        <>
          <GroupTitle title="Goal tracking" first />
          <GoalsConsent
            club={club}
            joinLabel="Turn on tracking"
            busy={g.busy === 'consent'}
            onJoin={() => void consent(true)}
            onNotNow={() => setConsentAsk(false)}
          />
        </>
      ) : (
        <>
          <GroupTitle title="Goal tracking" first />
          <ThemedText maxFontSizeMultiplier={1.3} style={styles.para}>
            {`${club.name} has shared goals. Turn on tracking to count them from this phone.`}
          </ThemedText>
          <TrackingSwitch on={false} busy={g.busy === 'consent'} onChange={(on) => on && setConsentAsk(true)} />
        </>
      )}

      {g.staff ? (
        <>
          <GroupTitle title={`Club goals (${data.goals.length} of ${GOALS_MAX})`} />
          {data.goals.length ? (
            <Surface level={1} style={styles.list}>
              {data.goals.map((goal, i) => (
                <StaffGoalRow
                  key={goal.goalId}
                  goal={goal}
                  summary={data.summary.find((s) => s.goalId === goal.goalId)}
                  clock={clock}
                  onPress={() => openGoal(goal.goalId)}
                  last={i === data.goals.length - 1}
                />
              ))}
            </Surface>
          ) : null}
          <View style={styles.gap}>
            <Button label="New goal" variant="tonal" onPress={newGoal} disabled={data.goals.length >= GOALS_MAX} />
          </View>
          {data.goals.length >= GOALS_MAX ? <GoalNote text={`A club can have ${GOALS_MAX} goals. Delete one to add another.`} /> : null}
        </>
      ) : null}

      {data.tracked ? (
        <View style={styles.gapLarge}>
          <TrackingSwitch on busy={g.busy === 'consent'} onChange={(on) => (on ? undefined : setStopAsk(true))} />
        </View>
      ) : null}

      <Dialog
        visible={stopAsk}
        title={STOP_TRACKING}
        message={STOP_TRACKING_WHY}
        confirmLabel="Stop tracking"
        onCancel={() => setStopAsk(false)}
        onConfirm={() => {
          setStopAsk(false);
          void consent(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  para: { marginBottom: Spacing.three },
  gap: { marginTop: Spacing.three },
  gapLarge: { marginTop: Spacing.four },
});
