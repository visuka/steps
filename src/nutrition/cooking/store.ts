/**
 * The factor tables on the phone (plan T15c, decision 3): downloaded after
 * sign-in from GET /v1/food/cooking, kept in private storage (kv) and asked for
 * again only when the cooking data version (`calc`) changes. They are never
 * bundled. They are forgotten on sign-out (state/use-food-book.ts calls
 * forgetTables) and with the rest on reset (Repository.clearAll).
 * Plain functions with their dependencies passed in, so jest runs them.
 */
import { readTables } from './tables';
import type { CookingTables } from './types';

/** kv key of the last good answer. */
export const COOKING_KEY = 'cookingTables';

export interface TablesDeps {
  repo: { getKv<T>(key: string): Promise<T | null>; setKv<T>(key: string, value: T): Promise<void> };
  /** GET /v1/food/cooking (api/food-api.ts fetchCookingTables). */
  fetch: () => Promise<unknown>;
}

/** Forgets the kept tables (sign-out): the next sign-in asks for them again. */
export async function forgetTables(repo: TablesDeps['repo']): Promise<void> {
  try {
    await repo.setKv(COOKING_KEY, null);
  } catch {
    // Not wiped now; the sign-out wipe tries again next time the app sees nobody signed in.
  }
}

/** The kept tables, or null when none were kept or they aren't a version this build knows. */
export async function keptTables(repo: TablesDeps['repo']): Promise<CookingTables | null> {
  try {
    return readTables(await repo.getKv<unknown>(COOKING_KEY));
  } catch {
    return null;
  }
}

/**
 * The tables to use. Kept ones stand unless `seenCalc` (the version on a
 * profile or food that just arrived) is not theirs; with none kept, or a newer
 * version seen, they are asked for. A failed or unreadable answer leaves what
 * was kept (or null): the app then uses the recipe look-up.
 */
export async function ensureTables(deps: TablesDeps, seenCalc?: string | null): Promise<CookingTables | null> {
  const kept = await keptTables(deps.repo);
  if (kept && (!seenCalc || seenCalc === kept.calc)) return kept;
  let answer: unknown;
  try {
    answer = await deps.fetch();
  } catch {
    return kept;
  }
  const fresh = readTables(answer);
  if (!fresh) return kept;
  try {
    await deps.repo.setKv(COOKING_KEY, fresh);
  } catch {
    // Not kept this time; used for now, asked for again next time.
  }
  return fresh;
}
