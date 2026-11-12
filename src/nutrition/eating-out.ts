/**
 * Meals eaten out (dine-in or ordered in) next to home-made ones, from the
 * person's own log: how many, and what a meal held on average. A pattern in
 * their own numbers, never a verdict on a meal; the UI words it that way.
 */
import type { FoodEntry } from '@/data/types';

import { restaurantKey } from './place';
import type { NutrientKey, Nutrients } from './types';

/** Foods logged from the same place within this long of a meal's first food are that meal. */
export const MEAL_SPAN_MIN = 60;
/**
 * Less than this together is a snack or a cup of tea, not a meal. Home logs
 * are full of those, and counting them would make home food look lighter
 * than it is.
 */
export const MEAL_MIN_KCAL = 250;
/** Each side needs this many meals before an average says anything. */
export const MIN_MEALS = 3;
/** What restaurant cooking most often adds: calories, salt and saturated fat (ghee, butter, cream). */
export const COMPARED: NutrientKey[] = ['kcal', 'sodium', 'satFat'];

export interface Meal {
  out: boolean;
  /** When its first food was logged. */
  at: number;
  /** COMPARED nutrients only. */
  nutrients: Nutrients;
}

export interface EatingOut {
  /** Meals eaten out (dine-in and ordered in together), and home-made ones. */
  out: number;
  home: number;
  /**
   * Average per meal on each side. Empty until both sides have MIN_MEALS
   * meals; a nutrient shows only when MIN_MEALS meals of each side know it.
   */
  averages: { key: NutrientKey; out: number; home: number }[];
}

/** Totals for a meal; a nutrient one food doesn't know is unknown for the meal, not a lower figure. */
function mealTotal(parts: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const key of COMPARED) {
    if (parts.every((p) => p[key] !== undefined)) out[key] = parts.reduce((sum, p) => sum + p[key]!, 0);
  }
  return out;
}

/** Entries grouped into meals by place (and restaurant) and time; snacks under MEAL_MIN_KCAL are left out. */
export function meals(entries: FoodEntry[], nutrientsOf: (e: FoodEntry) => Nutrients): Meal[] {
  const open = new Map<string, { at: number; out: boolean; parts: Nutrients[] }>();
  const groups: { at: number; out: boolean; parts: Nutrients[] }[] = [];
  for (const e of [...entries].sort((a, b) => a.loggedAt - b.loggedAt)) {
    const key = e.place === 'home' ? 'home' : `${e.place}|${e.restaurant ? restaurantKey(e.restaurant) : ''}`;
    let group = open.get(key);
    if (!group || e.loggedAt - group.at > MEAL_SPAN_MIN * 60_000) {
      group = { at: e.loggedAt, out: e.place !== 'home', parts: [] };
      open.set(key, group);
      groups.push(group);
    }
    group.parts.push(nutrientsOf(e));
  }
  return groups
    .map((g) => ({ out: g.out, at: g.at, nutrients: mealTotal(g.parts) }))
    .filter((m) => (m.nutrients.kcal ?? 0) >= MEAL_MIN_KCAL);
}

const average = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function eatingOut(entries: FoodEntry[], nutrientsOf: (e: FoodEntry) => Nutrients): EatingOut {
  const all = meals(entries, nutrientsOf);
  const out = all.filter((m) => m.out);
  const home = all.filter((m) => !m.out);
  const averages: EatingOut['averages'] = [];
  if (out.length >= MIN_MEALS && home.length >= MIN_MEALS) {
    for (const key of COMPARED) {
      const a = out.map((m) => m.nutrients[key]).filter((v): v is number => v !== undefined);
      const b = home.map((m) => m.nutrients[key]).filter((v): v is number => v !== undefined);
      if (a.length >= MIN_MEALS && b.length >= MIN_MEALS) averages.push({ key, out: average(a), home: average(b) });
    }
  }
  return { out: out.length, home: home.length, averages };
}

/** "4 meals eaten out (dine-in or ordered in) and 9 home-made." */
export function eatingOutSummary(e: EatingOut): string {
  return `${e.out} ${e.out === 1 ? 'meal' : 'meals'} eaten out (dine-in or ordered in) and ${e.home} home-made.`;
}
