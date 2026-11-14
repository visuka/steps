/**
 * Foods the server marked "pending": one of their ingredients is queued for
 * the server's ingredient agent, and the same look-up later gives fuller
 * values. This works out when to repeat the look-up quietly and how to fold
 * the answer into the saved food, keeping its id and units so past entries
 * stay as they were. Pure, so jest runs it; state/use-pending-foods.ts runs it.
 *
 * The rules: the first repeat waits 10 minutes from when the answer came
 * (FoodItem.pendingSince) and happens on the next app open, or the next
 * check while the app is open, after that; then at least 3 hours apart, at most 3 a day for a food
 * and 6 a day in all, 3 per app open; after 7 days the app stops asking (the
 * food keeps its "≥" figures). A repeat is a few kilobytes, so any network
 * will do; none is tried offline.
 */
import type { EstimateItem } from '@/api/food-read';

import { catalogFood, RECIPE_PREFIX } from './catalog';
import { lookupName, type Where, whereOf } from './place';
import type { FoodItem, FoodRecipeSource } from './types';

/** kv key of the PendingLog. */
export const PENDING_KEY = 'pendingFoods';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The first repeat waits this long after the pending answer came (else after the food was first seen pending). */
export const FIRST_WAIT_MS = 10 * MINUTE;
/** Later repeats of one food are at least this far apart. */
export const MIN_GAP_MS = 3 * HOUR;
/** Repeats of one food in any 24 hours. */
export const MAX_TRIES_PER_FOOD = 3;
/** Repeats of all foods in any 24 hours: each counts against the day's look-ups. */
export const MAX_TRIES_PER_DAY = 6;
/** Repeats in one go (one app open). */
export const MAX_PER_RUN = 3;
/** After this the app stops asking; the food keeps what it has. */
export const GIVE_UP_MS = 7 * DAY;

/** Food id → when it was first seen pending and when it was tried again (epoch ms). */
export type PendingLog = Record<string, { since: number; tries: number[] }>;

/** What the phone knows of its connection; 'unknown' when it can't tell. */
export type Network = 'wifi' | 'cellular' | 'other' | 'unknown' | 'none';

/** A repeat is tiny, so Wi-Fi, mobile data or anything else will do; offline nothing is tried. */
export const networkAllows = (n: Network): boolean => n !== 'none';

/** Saved foods still pending, or with a pending recipe or look-up the app can repeat. */
export const isPending = (f: FoodItem): boolean => f.pending === true && !catalogFood(f.id);

/**
 * The log for the foods saved now: a newly pending food starts its wait
 * from when its answer came (pendingSince), else from now; foods no longer pending (or deleted) are dropped, and tries older than a
 * day are forgotten. Malformed stored entries are dropped too.
 */
export function trackPending(log: PendingLog | null | undefined, saved: FoodItem[], now: number): PendingLog {
  const out: PendingLog = {};
  for (const f of saved) {
    if (!isPending(f)) continue;
    const prev = log && Object.prototype.hasOwnProperty.call(log, f.id) ? log[f.id] : undefined;
    const came = typeof f.pendingSince === 'number' && f.pendingSince <= now ? f.pendingSince : now;
    const since = typeof prev?.since === 'number' && prev.since <= now ? prev.since : came;
    const tries = Array.isArray(prev?.tries) ? prev.tries.filter((t) => typeof t === 'number' && t <= now && now - t < DAY) : [];
    out[f.id] = { since, tries };
  }
  return out;
}

/** The pending foods to look up again now, oldest first, within every limit. */
export function dueForRefresh(log: PendingLog, saved: FoodItem[], now: number, network: Network = 'unknown'): FoodItem[] {
  if (!networkAllows(network)) return [];
  const triedToday = Object.values(log).reduce((a, p) => a + p.tries.filter((t) => now - t < DAY).length, 0);
  const room = Math.min(MAX_PER_RUN, MAX_TRIES_PER_DAY - triedToday);
  if (room <= 0) return [];
  const due: { food: FoodItem; since: number }[] = [];
  for (const f of saved) {
    const p = log[f.id];
    if (!p || !isPending(f) || !refreshQuery(f)) continue;
    const age = now - p.since;
    if (age < FIRST_WAIT_MS || age >= GIVE_UP_MS) continue;
    const recent = p.tries.filter((t) => now - t < DAY);
    if (recent.length >= MAX_TRIES_PER_FOOD) continue;
    if (recent.length && now - Math.max(...recent) < MIN_GAP_MS) continue;
    due.push({ food: f, since: p.since });
  }
  return due
    .sort((a, b) => a.since - b.since)
    .slice(0, room)
    .map((d) => d.food);
}

/** The log with a try of `id` at `now`. */
export function recordTry(log: PendingLog, id: string, now: number): PendingLog {
  const prev = log[id] ?? { since: now, tries: [] };
  return { ...log, [id]: { since: prev.since, tries: [...prev.tries, now] } };
}

export type RefreshQuery =
  | { kind: 'estimate'; text: string; where: Where | null }
  | { kind: 'recipe'; request: FoodRecipeSource };

/**
 * How to ask again: a recipe as it was sent; anything else by its name, the
 * way it was worked out (home or restaurant). Null when it can't be asked.
 */
export function refreshQuery(food: FoodItem): RefreshQuery | null {
  if (food.id.startsWith(RECIPE_PREFIX)) return food.recipe ? { kind: 'recipe', request: food.recipe } : null;
  const text = lookupName(food);
  if (!text) return null;
  const where =
    food.style === 'restaurant' ? whereOf('dine-in', food.restaurant) : food.style === 'home' ? whereOf('home', null) : null;
  return { kind: 'estimate', text, where };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The food in a repeated look-up that is this one: the same id, else the only one of the same name. */
export function matchRefreshed(old: FoodItem, items: Pick<EstimateItem, 'food'>[]): FoodItem | null {
  const byId = items.find((i) => i.food.id === old.id);
  if (byId) return byId.food;
  const named = items.filter((i) => sameName(i.food.name, old.name));
  return named.length === 1 ? named[0].food : null;
}

/**
 * The saved food with the new values: nutrients, what's still missing and
 * whether it's still pending, with the working that goes with them. Id,
 * name, units and the phone's own notes stay, so every past entry (stored as
 * unit and quantity) keeps its amount and simply counts more.
 */
export function refreshedFood(old: FoodItem, fresh: FoodItem): FoodItem {
  const out: FoodItem = { ...old, per100g: { ...fresh.per100g }, source: fresh.source };
  delete out.missing;
  delete out.pending;
  delete out.pendingSince;
  delete out.recipe;
  delete out.ingredients;
  delete out.notes;
  delete out.flags;
  if (fresh.missing?.length) out.missing = [...fresh.missing];
  if (fresh.pending) {
    out.pending = true;
    if (old.pendingSince !== undefined) out.pendingSince = old.pendingSince;
    if (old.recipe) out.recipe = old.recipe;
  }
  if (fresh.ingredients?.length) out.ingredients = fresh.ingredients.map((i) => ({ ...i }));
  if (fresh.notes?.length) out.notes = [...fresh.notes];
  if (fresh.flags?.length) out.flags = [...fresh.flags];
  return out;
}

/** True when the refreshed food says something new: values, gaps or the pending mark changed. */
export function changed(old: FoodItem, next: FoodItem): boolean {
  return (
    JSON.stringify([old.per100g, old.missing ?? [], old.pending ?? false]) !==
    JSON.stringify([next.per100g, next.missing ?? [], next.pending ?? false])
  );
}
