import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { estimateFood, FoodApiError, recipeFood, type RecipeRequest } from '@/api/food-api';
import { changeFood, type SampleWriter } from '@/data/entries';
import type { Repository } from '@/data/types';
import { addDays, startOfDay } from '@/lib/dates';
import { nutrientsFor, type PortionOverrides } from '@/nutrition/catalog';
import {
  changed,
  dueForRefresh,
  FIRST_WAIT_MS,
  matchRefreshed,
  PENDING_KEY,
  type PendingLog,
  recordTry,
  refreshedFood,
  refreshQuery,
  trackPending,
} from '@/nutrition/pending';
import type { FoodItem } from '@/nutrition/types';

/** These end the run: trying another food now would fail the same way. */
const STOP: readonly string[] = ['offline', 'timeout', 'signin', 'limit', 'premium', 'busy', 'unavailable'];

/**
 * A refreshed food updates its entries of the last week: their stored
 * calories and their copy in Health Connect / Apple Health. Older entries
 * keep both as logged (their nutrients on screen still come from the food).
 */
const ENTRY_DAYS = 7;

/** What a run did: anything saved, and whether foods are still waiting (so another check is worth it). */
export interface RefreshRun {
  changed: boolean;
  waiting: boolean;
}

/**
 * Looks up due pending foods again (nutrition/pending.ts), saves what comes
 * back and updates the week's entries of each, with their health store copy
 * when `source` can write one. Each repeat is marked `refresh` for the server.
 */
export async function refreshPendingFoods(repo: Repository, source?: SampleWriter, now = Date.now()): Promise<RefreshRun> {
  const saved = await repo.getSavedFoods();
  let log = trackPending(await repo.getKv<PendingLog>(PENDING_KEY), saved, now);
  const due = dueForRefresh(log, saved, now);
  await repo.setKv(PENDING_KEY, log);
  if (!due.length) return { changed: false, waiting: Object.keys(log).length > 0 };

  let any = false;
  const overrides = (await repo.getKv<PortionOverrides>('portionOverrides')) ?? {};
  for (const food of due) {
    const q = refreshQuery(food);
    if (!q) continue;
    // Counted before asking, so a crash or a kill mid-way never repeats without limit.
    log = recordTry(log, food.id, now);
    await repo.setKv(PENDING_KEY, log);
    let fresh: FoodItem | null = null;
    try {
      fresh =
        q.kind === 'recipe'
          ? // Checked against the recipe limits and units when read back (api/food-read.ts).
            (await recipeFood(q.request as RecipeRequest, { refresh: true })).food
          : matchRefreshed(food, (await estimateFood(q.text, q.where, { refresh: true })).items);
    } catch (e) {
      if (e instanceof FoodApiError && STOP.includes(e.kind)) break;
      continue;
    }
    if (!fresh) continue;
    const next = refreshedFood(food, fresh);
    if (!changed(food, next)) continue;
    await repo.saveSavedFood(next);
    await updateEntries(repo, source, next, overrides, now);
    any = true;
  }
  log = trackPending(log, await repo.getSavedFoods(), now);
  await repo.setKv(PENDING_KEY, log);
  return { changed: any, waiting: Object.keys(log).length > 0 };
}

/**
 * The week's entries of a refreshed food: new calories, and a new health
 * store copy with the new values (the old one had the "at least" figures).
 */
export async function updateEntries(
  repo: Repository,
  source: SampleWriter | undefined,
  food: FoodItem,
  overrides: PortionOverrides,
  now: number,
): Promise<void> {
  const from = addDays(startOfDay(new Date(now)), -(ENTRY_DAYS - 1)).getTime();
  const entries = await repo.getFoods(from, now + 24 * 3600_000);
  for (const e of entries) {
    if (e.foodId !== food.id || !e.unit || e.quantity === null) continue;
    const nutrients = nutrientsFor(food, e.unit, e.quantity, overrides);
    const kcal = Math.round(nutrients.kcal ?? e.kcal);
    if (e.healthSampleId && source) {
      // The values changed (or this wouldn't run), so the copy is replaced even when calories didn't.
      await changeFood(repo, source, e, { ...e, kcal }, nutrients).catch(() => undefined);
    } else if (kcal !== e.kcal) {
      await repo.updateFood({ ...e, kcal });
    }
  }
}

/**
 * Runs refreshPendingFoods when the app opens, each time it comes back to
 * the front, and every 10 minutes while it stays in front with foods still
 * waiting, while `on` (signed in, with food look-ups). `onChanged` reloads
 * what the screens show; pass a stable function (useApp's touch). `source`
 * (stable too) gets the refreshed copies of the entries.
 */
export function usePendingFoods(
  repo: Repository | null,
  source: SampleWriter | null,
  on: boolean,
  onChanged: () => void,
): void {
  const running = useRef(false);

  useEffect(() => {
    if (!repo || !on) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stopTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const run = () => {
      if (running.current || !live) return;
      stopTimer();
      running.current = true;
      refreshPendingFoods(repo, source ?? undefined)
        .then((r) => {
          if (r.changed && live) onChanged();
          // A check only reads the phone's list; dueForRefresh decides whether anything is asked.
          if (r.waiting && live && AppState.currentState === 'active') timer = setTimeout(run, FIRST_WAIT_MS);
        })
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
        });
    };
    run();
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? run() : stopTimer()));
    return () => {
      live = false;
      stopTimer();
      sub.remove();
    };
  }, [repo, source, on, onChanged]);
}
