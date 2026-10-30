export const DEFAULT_GOAL = 7000;
export const MIN_GOAL = 2000;
export const MAX_GOAL = 30000;
export const GOAL_STEP = 500;

/** Days of history needed before the app suggests a new goal. */
export const SUGGESTION_DAYS = 14;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function clampGoal(goal: number): number {
  const rounded = Math.round(goal / GOAL_STEP) * GOAL_STEP;
  return Math.min(MAX_GOAL, Math.max(MIN_GOAL, rounded));
}

/**
 * About 10% above the user's recent median, rounded to 500. Only ever a step
 * up: returns null when there isn't enough history or the user isn't yet
 * walking past their current goal.
 */
export function suggestGoal(recentDailySteps: number[], currentGoal: number): number | null {
  if (recentDailySteps.length < SUGGESTION_DAYS) return null;
  const suggestion = clampGoal(median(recentDailySteps.slice(-SUGGESTION_DAYS)) * 1.1);
  return suggestion > currentGoal ? suggestion : null;
}
