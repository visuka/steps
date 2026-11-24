import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { GoalNote, GroupTitle, MyGoalRow, TrackingSwitch } from '@/components/buddies/goals/goal-parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, Snackbar, Surface, ToggleRow } from '@/components/ui';
import { dueOn } from '@/buddies/goals';
import { type MyClubGoals, useMyGoals } from '@/buddies/use-goals';
import { Spacing } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * My goals across every club I am in that has them: today's goals with
 * Mark done / Undo (or the phone's count), the goal tracking switch for a
 * club I joined before goals were on, and whether captains' reminders reach me.
 */
export default function MyGoalsScreen() {
  const router = useRouter();
  const clock = useClockStyle();
  const g = useMyGoals();
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const openClub = (clubId: string) => router.push({ pathname: '/buddies/club/[id]', params: { id: clubId, seg: 'goals' } } as never);
  const list = g.data ?? [];

  const block = (x: MyClubGoals) => {
    const goals = x.goals;
    if (!goals) return <GoalNote text="These goals could not be loaded. Try again later." />;
    if (!goals.tracked) {
      return (
        <TrackingSwitch
          on={false}
          busy={g.busy === `consent/${x.club.clubId}`}
          onChange={async (on) => show((await g.setConsent(x.club.clubId, on)) ?? (on ? 'Goal tracking is on.' : null))}
        />
      );
    }
    const due = goals.goals.filter((goal) => dueOn(goal, g.today));
    if (!due.length) return <GoalNote text={goals.goals.length ? 'No goals for today.' : 'No goals yet.'} />;
    return (
      <Surface level={1} style={styles.list}>
        {due.map((goal, i) => (
          <MyGoalRow
            key={goal.goalId}
            goal={goal}
            mark={goals.mine.find((m) => m.goalId === goal.goalId) ?? null}
            phone={g.phone}
            clock={clock}
            busy={g.busy === `${x.club.clubId}/${goal.goalId}`}
            onMark={async (done) => show(await g.mark(x.club.clubId, goal.goalId, done))}
            first={i === 0}
          />
        ))}
      </Surface>
    );
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="My goals" onBack={back}>
      <Screen title="My goals" onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        <Surface level={1} style={styles.list}>
          <ToggleRow
            title="Goal reminders"
            supporting="When a captain sends a gentle reminder"
            value={g.reminders}
            disabled={!g.remindersKnown || g.busy === 'notify'}
            onValueChange={async (on) => show((await g.setReminders(on)) ?? (on ? 'Goal reminders are on.' : 'Goal reminders are off.'))}
          />
        </Surface>

        {g.error && !g.data ? (
          <ThemedText themeColor="onSurfaceVariant" style={styles.gap} maxFontSizeMultiplier={1.3}>
            {g.error}
          </ThemedText>
        ) : null}
        {g.data && !list.length ? (
          <EmptyState icon="checkbox-outline" title="No club goals yet" hint="Clubs can set shared goals, like a morning walk. Join a club, or start one." />
        ) : null}

        {list.map((x) => (
          <View key={x.club.clubId}>
            <GroupTitle title={x.club.name} />
            {block(x)}
            <View style={styles.open}>
              <Button label="Open club" variant="text" compact onPress={() => openClub(x.club.clubId)} accessibilityLabel={`Open ${x.club.name}`} />
            </View>
          </View>
        ))}
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  gap: { marginTop: Spacing.three },
  open: { marginTop: Spacing.one, alignItems: 'flex-start' },
});
