import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Stepper } from '@/components/controls';
import { FoodAndWaterRows } from '@/components/food/food-settings';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, Screen, SectionHeader, StatTile, Surface, TickBar } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type Achievement,
  achievementId,
  achievementTitle,
  type AchievementKind,
  LIFETIME_MILESTONES,
  STREAK_MILESTONES,
} from '@/lib/achievements';
import { addDaysToKey, dayKey } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { GOAL_STEP, MAX_GOAL, MIN_GOAL, SUGGESTION_DAYS, suggestGoal } from '@/lib/goals';
import { computeStreaks, type Streaks } from '@/lib/streaks';
import { useApp } from '@/state/app-state';
import { usePremium } from '@/state/use-premium';

const BADGES: { kind: AchievementKind; value: number }[] = [
  ...STREAK_MILESTONES.map((value) => ({ kind: 'streak' as const, value })),
  ...LIFETIME_MILESTONES.map((value) => ({ kind: 'lifetime' as const, value })),
];

/** You: the daily goal, streaks and badges, then Insights, Settings and the account, all in one place. */
export default function YouScreen() {
  const { repo, profile, dataVersion, updateProfile } = useApp();
  const router = useRouter();
  const theme = useTheme();
  // Setting the goal is free, as the track it counts to is; streaks, badges and suggestions come from history.
  const premium = usePremium();
  const history = !premium.isLocked('history');
  const [streaks, setStreaks] = useState<Streaks>({ current: 0, best: 0 });
  const [lifetime, setLifetime] = useState(0);
  const [earned, setEarned] = useState<Map<string, Achievement>>(new Map());
  const [suggestion, setSuggestion] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const today = dayKey(new Date());
      const [rows, total, achievements] = await Promise.all([
        repo.getDays(addDaysToKey(today, -1100), today),
        repo.lifetimeSteps(),
        repo.getAchievements(),
      ]);
      if (!live) return;
      setStreaks(computeStreaks(rows, today));
      setLifetime(total);
      setEarned(new Map(achievements.map((a) => [a.id, a])));
      const recent = rows.filter((r) => r.date < today).slice(-SUGGESTION_DAYS);
      setSuggestion(suggestGoal(recent.map((r) => r.steps), profile.dailyGoal));
    })();
    return () => {
      live = false;
    };
  }, [repo, dataVersion, profile.dailyGoal]);

  return (
    <Screen title="You">
      <Card title="Daily goal">
        <Stepper
          value={profile.dailyGoal}
          onChange={(dailyGoal) => updateProfile({ dailyGoal })}
          step={GOAL_STEP}
          min={MIN_GOAL}
          max={MAX_GOAL}
          format={formatSteps}
        />
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          From today on. Past days keep theirs.
        </ThemedText>
        {history && suggestion ? (
          <Button
            variant="tonal"
            label={`Use ${formatSteps(suggestion)}, from your last 2 weeks`}
            onPress={() => updateProfile({ dailyGoal: suggestion })}
          />
        ) : null}
      </Card>

      {history ? (
        <View style={styles.row}>
          <StatTile icon="flame-outline" label="Streak" value={String(streaks.current)} unit="days" style={styles.half} />
          <StatTile icon="trophy-outline" label="Best streak" value={String(streaks.best)} unit="days" style={styles.half} />
        </View>
      ) : null}

      <SectionHeader title="Badges" />
      <PremiumGate feature="history">
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          {formatSteps(lifetime)} steps so far
        </ThemedText>
        <View style={styles.badges}>
          {BADGES.map((b) => {
            const id = achievementId(b.kind, b.value);
            const got = earned.get(id);
            const progress = b.kind === 'streak' ? streaks.best / b.value : lifetime / b.value;
            return (
              <Surface key={id} level={got ? 3 : 1} radius={Radius.md} style={styles.badge}>
                <Ionicons
                  name={b.kind === 'streak' ? (got ? 'flame' : 'flame-outline') : got ? 'footsteps' : 'footsteps-outline'}
                  size={24}
                  color={got ? theme.steps : theme.onSurfaceVariant}
                />
                <ThemedText type="labelLarge" style={styles.center}>
                  {achievementTitle(b.kind, b.value)}
                </ThemedText>
                {got ? (
                  <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.center}>
                    {new Date(got.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </ThemedText>
                ) : (
                  <TickBar
                    value={Math.min(0.99, progress)}
                    max={1}
                    height={8}
                    accessibilityLabel={`${Math.min(99, Math.floor(progress * 100))}% there`}
                  />
                )}
              </Surface>
            );
          })}
        </View>
      </PremiumGate>

      <FoodAndWaterRows />

      <SectionHeader title="More" />
      <Surface level={1} style={styles.list}>
        <ListRow
          icon="book-outline"
          title="Journal"
          supporting="Your days: steps, food, sleep, notes"
          chevron
          onPress={() => router.navigate('/journal')}
        />
        <ListRow
          icon="analytics-outline"
          title="Insights"
          supporting="What helps you walk more"
          chevron
          onPress={() => router.push('/insights')}
        />
        <ListRow
          icon="settings-outline"
          title="Settings and account"
          supporting="Profile, reminders, sign-in, your data"
          chevron
          onPress={() => router.push('/settings')}
        />
        <ListRow
          icon="checkmark-done-outline"
          title="Step check"
          supporting="If your steps look wrong"
          chevron
          onPress={() => router.push('/step-check')}
        />
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  half: { flexBasis: 0, minWidth: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three - 4,
  },
  center: { textAlign: 'center' },
  list: { overflow: 'hidden', paddingVertical: Spacing.one },
});
