export type AchievementKind = 'streak' | 'lifetime';

export interface Achievement {
  id: string;
  kind: AchievementKind;
  value: number;
  earnedAt: number;
}

export const STREAK_MILESTONES = [7, 30, 100];
export const LIFETIME_MILESTONES = [100_000, 1_000_000];

export const achievementId = (kind: AchievementKind, value: number) => `${kind}-${value}`;

export function achievementTitle(kind: AchievementKind, value: number): string {
  if (kind === 'streak') return `${value}-day streak`;
  return value >= 1_000_000 ? `${value / 1_000_000}M lifetime steps` : `${value / 1000}k lifetime steps`;
}

/** Milestones reached but not yet stored. */
export function newAchievements(
  progress: { bestStreak: number; lifetimeSteps: number },
  earnedIds: Set<string>,
  now = Date.now(),
): Achievement[] {
  const reached: Achievement[] = [];
  for (const value of STREAK_MILESTONES) {
    const id = achievementId('streak', value);
    if (progress.bestStreak >= value && !earnedIds.has(id)) {
      reached.push({ id, kind: 'streak', value, earnedAt: now });
    }
  }
  for (const value of LIFETIME_MILESTONES) {
    const id = achievementId('lifetime', value);
    if (progress.lifetimeSteps >= value && !earnedIds.has(id)) {
      reached.push({ id, kind: 'lifetime', value, earnedAt: now });
    }
  }
  return reached;
}
