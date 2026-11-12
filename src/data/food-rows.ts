/**
 * Food log rows as stored, and back. No expo-sqlite here, so jest can run it.
 * Place and restaurant are checked on the way out like saved foods are, so a
 * row from an older app version (or a bad write) reads as home-made.
 */
import { whereOf } from '@/nutrition/place';

import type { FoodEntry } from './types';

export interface FoodRow {
  id: string;
  logged_at: number;
  name: string;
  food_id: string | null;
  unit: string | null;
  quantity: number | null;
  kcal: number;
  health_sample_id: string | null;
  place: string | null;
  restaurant: string | null;
}

export const toFood = (r: FoodRow): FoodEntry => ({
  id: r.id,
  loggedAt: r.logged_at,
  name: r.name,
  foodId: r.food_id,
  unit: r.unit,
  quantity: r.quantity,
  kcal: r.kcal,
  healthSampleId: r.health_sample_id,
  ...whereOf(r.place, r.restaurant),
});

/** An entry from the web preview's saved snapshot, which may predate place and restaurant. */
export function readSnapshotFood(e: Omit<FoodEntry, 'place' | 'restaurant'> & Partial<FoodEntry>): FoodEntry {
  return { ...e, ...whereOf(e.place, e.restaurant) };
}
