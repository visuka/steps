/**
 * Brings sleep, heart rate and blood pressure in from Apple Health / Health
 * Connect once the person has connected them. Runs when the app comes to the
 * foreground, like the weather, and at most every half hour.
 */
import type { Repository } from '@/data/types';
import { vitalsSource } from '@/health/vitals';
import { addDays, dayKey, startOfDay } from '@/lib/dates';

const CONNECTED_KEY = 'vitalsConnected';
const SYNCED_KEY = 'vitalsSyncedAt';
/** The first read goes back far enough for the month-on-month heart rate pattern. */
const FIRST_DAYS = 60;
/** Later reads go over the last few days again, so late watch uploads and edits land. */
const AGAIN_DAYS = 3;
const MIN_GAP_MS = 30 * 60_000;

export async function vitalsConnected(repo: Repository): Promise<boolean> {
  return (await repo.getKv<boolean>(CONNECTED_KEY)) === true;
}

/** Shows the permission screen, then reads everything in. False when there's nothing to connect to or it was refused. */
export async function connectVitals(repo: Repository): Promise<boolean> {
  if (!vitalsSource || !(await vitalsSource.isAvailable())) return false;
  if (!(await vitalsSource.requestAccess())) return false;
  await repo.setKv(CONNECTED_KEY, true);
  await repo.setKv(SYNCED_KEY, null);
  await syncVitals(repo, true);
  return true;
}

/** True when anything was read. */
export async function syncVitals(repo: Repository, force = false): Promise<boolean> {
  if (!vitalsSource || !(await vitalsConnected(repo))) return false;
  const now = new Date();
  const last = await repo.getKv<number>(SYNCED_KEY);
  if (!force && last && now.getTime() - last < MIN_GAP_MS) return false;

  const from = startOfDay(addDays(now, -(last ? AGAIN_DAYS : FIRST_DAYS)));
  const until = now.getTime() + 1;
  // Each kind can be allowed or refused on its own; a refused one just reads nothing.
  const [sleep, heart, bp] = await Promise.all([
    // Sleep that ended on the first morning started the evening before.
    vitalsSource.readSleep(addDays(from, -1), now).catch(() => null),
    vitalsSource.readHeartDays(from, now).catch(() => null),
    vitalsSource.readBloodPressure(from, now).catch(() => null),
  ]);

  const fromKey = dayKey(from);
  if (sleep) await repo.replaceHealthSleep(fromKey, dayKey(now), sleep.filter((s) => s.date >= fromKey));
  if (heart) await repo.upsertHeartDays(heart);
  if (bp) {
    // Readings typed here were also saved there; don't bring them back as second copies.
    const own = new Set(
      (await repo.getBloodPressure(from.getTime(), until)).flatMap((b) =>
        b.source === 'manual' && b.healthId ? [b.healthId] : [],
      ),
    );
    await repo.replaceHealthBloodPressure(
      from.getTime(),
      until,
      bp.filter((b) => !b.healthId || !own.has(b.healthId)),
    );
  }
  await repo.setKv(SYNCED_KEY, now.getTime());
  return Boolean(sleep?.length || heart?.length || bp?.length);
}
