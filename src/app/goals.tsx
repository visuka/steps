import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Stepper } from '@/components/controls';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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

const BADGES: { kind: AchievementKind; value: number }[] = [
  ...STREAK_MILESTONES.map((value) => ({ kind: 'streak' as const, value })),
  ...LIFETIME_MILESTONES.map((value) => ({ kind: 'lifetime' as const, value })),
];

export default function GoalsScreen() {
  const { repo, profile, dataVersion, updateProfile } = useApp();
  const theme = useTheme();
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
    <Screen title="Goals">
      <View style={styles.streakRow}>
        <Card style={styles.streakCard}>
          <Ionicons name="flame" size={22} color={theme.accent} />
          <ThemedText style={styles.big}>{streaks.current}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Current streak (days)
          </ThemedText>
        </Card>
        <Card style={styles.streakCard}>
          <Ionicons name="trophy" size={22} color={theme.accent} />
          <ThemedText style={styles.big}>{streaks.best}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Best streak (days)
          </ThemedText>
        </Card>
      </View>

      <Card title="Daily goal">
        <Stepper
          value={profile.dailyGoal}
          onChange={(dailyGoal) => updateProfile({ dailyGoal })}
          step={GOAL_STEP}
          min={MIN_GOAL}
          max={MAX_GOAL}
          format={formatSteps}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Changes apply from today. Past days keep the goal they had.
        </ThemedText>
        {suggestion ? (
          <Button
            kind="secondary"
            label={`Use suggested goal: ${formatSteps(suggestion)}`}
            onPress={() => updateProfile({ dailyGoal: suggestion })}
          />
        ) : null}
      </Card>

      <Card title="Badges" right={<ThemedText type="small" themeColor="textSecondary">{formatSteps(lifetime)} lifetime steps</ThemedText>}>
        <View style={styles.badges}>
          {BADGES.map((b) => {
            const got = earned.get(achievementId(b.kind, b.value));
            const progress = b.kind === 'streak' ? streaks.best / b.value : lifetime / b.value;
            return (
              <ThemedView
                key={achievementId(b.kind, b.value)}
                type={got ? 'background' : 'backgroundSelected'}
                style={[styles.badge, got && { borderColor: theme.accent }]}>
                <Ionicons
                  name={b.kind === 'streak' ? 'flame' : 'footsteps'}
                  size={22}
                  color={got ? theme.accent : theme.textSecondary}
                />
                <ThemedText type="smallBold" style={styles.badgeText}>
                  {achievementTitle(b.kind, b.value)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.badgeText}>
                  {got
                    ? `Earned ${new Date(got.earnedAt).toLocaleDateString()}`
                    : `${Math.min(99, Math.floor(progress * 100))}% there`}
                </ThemedText>
              </ThemedView>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  streakRow: { flexDirection: 'row', gap: Spacing.three },
  streakCard: { flex: 1, gap: Spacing.one },
  big: { fontSize: 36, lineHeight: 44, fontWeight: 700, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeText: { textAlign: 'center' },
});
