/**
 * Where a food came from: made at home, eaten at a restaurant, or ordered in.
 * Restaurant versions of dishes usually have more oil, ghee, butter, cream and
 * salt, and bigger portions, so eaten out a home dish is logged as its
 * restaurant version (the server works one out). Plain foods (fruit, milk,
 * eggs) are the same wherever they're eaten. No React Native here, so jest can
 * run it.
 */
import type { EstimateItem, EstimateResult } from '@/api/food-read';
import type { FoodEntry, FoodPlace, RecentFood } from '@/data/types';

import { AI_PREFIX, catalogFood, gramsFor, type PortionOverrides, RECIPE_PREFIX } from './catalog';
import type { FoodItem } from './types';

/** The server's limit (stepsinfra food/handler.py). */
export const RESTAURANT_MAX = 60;

export const PLACES: { value: FoodPlace; label: string }[] = [
  { value: 'home', label: 'Home-made' },
  { value: 'dine-in', label: 'Dine-in' },
  { value: 'delivery', label: 'Ordered in' },
];

export interface Where {
  place: FoodPlace;
  /** Cleaned (cleanRestaurant); null for home-made food or when none was named. */
  restaurant: string | null;
}

export const HOME: Where = { place: 'home', restaurant: null };

export const isPlace = (v: unknown): v is FoodPlace => v === 'home' || v === 'dine-in' || v === 'delivery';

/** A stored or sent place; anything unknown is home-made, the default. */
export const readPlace = (v: unknown): FoodPlace => (isPlace(v) ? v : 'home');

/**
 * A restaurant name made safe to keep and to send: one line, no angle
 * brackets (it goes into a prompt as data), at most 60 characters. Null when
 * nothing is left.
 */
export function cleanRestaurant(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RESTAURANT_MAX).trim();
  return t || null;
}

/** Place and restaurant as kept: home-made food never has a restaurant. */
export function whereOf(place: unknown, restaurant: unknown): Where {
  const p = readPlace(place);
  return { place: p, restaurant: p === 'home' ? null : cleanRestaurant(restaurant) };
}

/** "Paradise " and "paradise" are the same restaurant. */
export const restaurantKey = (name: string) => name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const sameRestaurant = (a: string | null | undefined, b: string | null | undefined) =>
  (a ? restaurantKey(a) : '') === (b ? restaurantKey(b) : '');

/** "Dine-in · Paradise", "Ordered in"; null for home-made, the usual case, which needs no label. */
export function placeLabel(w: Where): string | null {
  if (w.place === 'home') return null;
  const label = PLACES.find((p) => p.value === w.place)!.label;
  return w.restaurant ? `${label} · ${w.restaurant}` : label;
}

/** Recipes are the person's own cooking, so they're home-made by definition. */
export const asksPlace = (food: FoodItem) => !food.id.startsWith(RECIPE_PREFIX);

/** AI foods the server would work out again for a restaurant, but that are the same anywhere. */
const PLAIN_AI: FoodItem['category'][] = ['fruit', 'nut'];

/**
 * A home version of a dish: a built-in dish or bread (worked out from home
 * recipes, the server's is_home_recipe), or a dish our server worked out
 * home-style. The server keeps a restaurant version of any AI dish whatever
 * its category (fish fry, egg bhurji, gulab jamun), so for those the style
 * decides. Plain foods and anything the person entered themselves are the
 * same wherever eaten.
 */
export function isHomeDish(food: FoodItem): boolean {
  if (catalogFood(food.id)) return food.category === 'dish' || food.category === 'bread';
  return food.id.startsWith(AI_PREFIX) && food.style !== 'restaurant' && !PLAIN_AI.includes(food.category);
}

export type VersionChange =
  /** Log the restaurant version of `base` instead: one already saved, or one look-up. */
  | { kind: 'restaurant'; base: FoodItem }
  /** Log this home version instead (a restaurant dish now marked home-made). */
  | { kind: 'home'; food: FoodItem }
  | null;

/** Which version of `food` to log for where it was from, or null to log it as it is. */
export function versionChange(food: FoodItem, w: Where, find: (id: string) => FoodItem | null): VersionChange {
  if (!asksPlace(food)) return null;
  const home = food.style === 'restaurant' && food.homeId ? find(food.homeId) : null;
  if (w.place === 'home') return home ? { kind: 'home', food: home } : null;
  if (isHomeDish(food)) return { kind: 'restaurant', base: food };
  // Worked out for another restaurant (or none): the version for this one instead.
  if (home && !sameRestaurant(food.restaurant, w.restaurant)) return { kind: 'restaurant', base: home };
  return null;
}

/** A restaurant version of `base` already on the phone, so it needs no look-up. */
export function savedRestaurantVersion(base: FoodItem, w: Where, saved: FoodItem[]): FoodItem | null {
  return (
    saved.find((f) => f.style === 'restaurant' && f.homeId === base.id && sameRestaurant(f.restaurant, w.restaurant)) ?? null
  );
}

/**
 * True when logging `food` from `w` would send its name (and the restaurant)
 * to our server for the restaurant version, so the person can be told first.
 */
export function needsLookup(food: FoodItem, w: Where, find: (id: string) => FoodItem | null, saved: FoodItem[]): boolean {
  const change = versionChange(food, w, find);
  return change?.kind === 'restaurant' && !savedRestaurantVersion(change.base, w, saved);
}

/**
 * Where the chips start for a food picked from the list. A restaurant version
 * was worked out for eating out, so it starts where it was last eaten (else
 * dine-in) at its own restaurant; left on home-made, Add would quietly log the
 * home dish instead of the one tapped. Null: keep what the chips say.
 */
export function startingPlace(food: FoodItem, recent: Pick<RecentFood, 'foodId' | 'place'>[]): Where | null {
  if (food.style !== 'restaurant') return null;
  const last = recent.find((r) => r.foodId === food.id && r.place !== 'home');
  return whereOf(last?.place ?? 'dine-in', food.restaurant);
}

/**
 * The name to look up for a restaurant version. The server splits text on
 * commas and "/", and "home-style" would argue with the restaurant style:
 * "Dal (toor, home-style)" → "Dal (toor)", "Chapati / roti" → "Chapati".
 */
export function lookupName(food: FoodItem): string {
  return food.name
    .split(' / ')[0]
    .replace(/\bhome-style\b/gi, ' ')
    .replace(/[,+&;]/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * The restaurant version in the server's answer: the first item worked out
 * restaurant-style. A server that doesn't know places sends the built-in
 * dish back, which is no answer.
 */
export function restaurantItem(result: EstimateResult): EstimateItem | null {
  return result.items.find((i) => i.style === 'restaurant' && !catalogFood(i.food.id)) ?? null;
}

/**
 * A food from a look-up as kept on the phone, marked with how it was worked
 * out and for where, so it's never mistaken for the other version later.
 * `homeId` is the home dish it was asked for, when there was one.
 */
export function markStyle(food: FoodItem, style: EstimateItem['style'], w: Where | null, homeId?: string): FoodItem {
  const out: FoodItem = { ...food };
  delete out.style;
  delete out.restaurant;
  delete out.homeId;
  if (style === 'home' || style === 'restaurant') out.style = style;
  if (style === 'restaurant' && w?.restaurant) out.restaurant = w.restaurant;
  if (style === 'restaurant' && homeId) out.homeId = homeId;
  return out;
}

/**
 * A marked food with the notes of the one saved under its id. The server
 * gives a restaurant dish the same id whoever asks, so a direct look-up of a
 * dish already kept as a home dish's restaurant version would otherwise drop
 * its home dish, and with it the switch back to home-made. The same id means
 * the same restaurant, so its name carries over too.
 */
export function keepSavedNotes(food: FoodItem, saved: FoodItem[]): FoodItem {
  const prev = saved.find((f) => f.id === food.id);
  if (food.style !== 'restaurant' || prev?.style !== 'restaurant') return food;
  const out: FoodItem = { ...food };
  if (!out.homeId && prev.homeId) out.homeId = prev.homeId;
  if (!out.restaurant && prev.restaurant) out.restaurant = prev.restaurant;
  return out;
}

/**
 * The same amount in another version of a food: "1 plate" stays one plate (a
 * restaurant plate is bigger, which is the point); a unit the other version
 * lacks becomes the same weight in grams.
 */
export function samePortion(
  from: FoodItem,
  unit: string,
  quantity: number,
  to: FoodItem,
  overrides: PortionOverrides,
): { unit: string; quantity: number } {
  if (to.units.some((u) => u.key === unit)) return { unit, quantity };
  return { unit: 'g', quantity: Math.round(gramsFor(from, unit, quantity, overrides)) };
}

/**
 * A note for an entry whose numbers don't match where it was from: eaten out
 * but logged with home values (the restaurant version couldn't be had:
 * offline, or the day's look-ups used up), or marked home-made but holding a
 * restaurant version with no home one to switch to.
 */
export function valuesNote(entry: Pick<FoodEntry, 'place'>, food: FoodItem | null): string | null {
  if (!food) return null;
  if (entry.place !== 'home' && isHomeDish(food)) return 'Home-style values used';
  if (entry.place === 'home' && food.style === 'restaurant') return 'Restaurant-style values used';
  return null;
}

/** Restaurant names from past entries, latest first, each once however it was typed. */
export function recentRestaurants(rows: { restaurant: string | null; loggedAt: number }[], limit = 6): string[] {
  const seen = new Map<string, { name: string; at: number }>();
  for (const r of rows) {
    const name = cleanRestaurant(r.restaurant);
    if (!name) continue;
    const key = restaurantKey(name);
    const prev = seen.get(key);
    if (!prev || r.loggedAt > prev.at) seen.set(key, { name, at: r.loggedAt });
  }
  return [...seen.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((s) => s.name);
}
