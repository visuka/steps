/**
 * Energy out for the eaten-vs-burned balance. Burned = resting energy (what the
 * body uses anyway) + the active calories from walking. Both are estimates.
 */
import type { Profile } from '@/data/types';

/** Used when the birth year isn't set. */
export const DEFAULT_AGE = 30;

/** Mifflin–St Jeor resting energy per day. Without a sex set, the midpoint of the two formulas. */
export function restingKcalPerDay(
  p: Pick<Profile, 'weightKg' | 'heightCm' | 'sex' | 'birthYear'>,
  year: number,
): number {
  const age = p.birthYear ? Math.max(14, year - p.birthYear) : DEFAULT_AGE;
  const offset = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * age + offset);
}

/** Resting energy from local midnight to `now` (all of it for a finished day). */
export function restingKcalSoFar(p: Pick<Profile, 'weightKg' | 'heightCm' | 'sex' | 'birthYear'>, now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fraction = Math.min(1, (now.getTime() - midnight.getTime()) / 86_400_000);
  return Math.round(restingKcalPerDay(p, now.getFullYear()) * fraction);
}
