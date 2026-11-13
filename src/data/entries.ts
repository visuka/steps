/**
 * Changing and deleting journal entries. Day totals (food, water) are added
 * up from the entries each time they're shown, so an entry moved to another
 * day leaves the old day's total and joins the new one's at once. Journal
 * entries stay on the phone; nothing is sent to our server.
 *
 * The phone's copy is always saved first. The copy written to Health Connect /
 * Apple Health follows, and when that fails the phone's edit is kept.
 */
import type { StepSource } from '@/health/types';
import type { VitalsSource } from '@/health/vitals.types';
import { dayKey } from '@/lib/dates';
import type { Nutrients } from '@/nutrition/types';

import type { BloodPressureEntry, FoodEntry, LogEntry, LogKind, MoodEntry, Repository, SleepEntry } from './types';

/** What happened to the health store's copy: there was none, it was changed, or it couldn't be. */
export type HealthCopy = 'none' | 'updated' | 'failed';

type Remove = (id: string) => Promise<void>;
type Write = () => Promise<string | null>;

/** The step source's health store calls these need. */
export type SampleWriter = Pick<StepSource, 'deleteSample' | 'writeFood' | 'writeWeight' | 'writeWater'>;
export type BpWriter = Pick<VitalsSource, 'writeBloodPressure' | 'deleteBloodPressure'>;

/**
 * Swaps the health store's copy for one with the new values. Neither store
 * has an update call, so the old copy is deleted and a new one written. When
 * the old copy can't be deleted it stays, with its id, rather than leave two.
 */
export async function replaceCopy(
  oldId: string | null,
  remove: Remove | undefined,
  write: Write | undefined,
): Promise<{ id: string | null; result: HealthCopy }> {
  if (!oldId) return { id: null, result: 'none' };
  if (!remove) return { id: oldId, result: 'failed' };
  try {
    await remove(oldId);
  } catch {
    return { id: oldId, result: 'failed' };
  }
  if (!write) return { id: null, result: 'failed' };
  try {
    return { id: (await write()) ?? null, result: 'updated' };
  } catch {
    return { id: null, result: 'failed' };
  }
}

async function removeCopy(id: string | null, remove: Remove | undefined): Promise<HealthCopy> {
  if (!id) return 'none';
  if (!remove) return 'failed';
  try {
    await remove(id);
    return 'updated';
  } catch {
    return 'failed';
  }
}

const sampleRemover = (source: SampleWriter, kind: 'food' | LogKind): Remove | undefined =>
  source.deleteSample ? (id) => source.deleteSample!(kind, id) : undefined;

/**
 * Saves a changed food entry over the old one: the same id, so never a second
 * entry. Name, food, portion, place and restaurant are whatever `after` says.
 */
export async function changeFood(
  repo: Repository,
  source: SampleWriter,
  before: FoodEntry,
  after: FoodEntry,
  nutrients: Nutrients,
): Promise<HealthCopy> {
  const entry: FoodEntry = { ...after, id: before.id, healthSampleId: before.healthSampleId };
  await repo.updateFood(entry);
  const write = source.writeFood;
  const copy = await replaceCopy(
    before.healthSampleId,
    sampleRemover(source, 'food'),
    write ? () => write.call(source, entry.name, nutrients, new Date(entry.loggedAt)) : undefined,
  );
  if (copy.id !== entry.healthSampleId) await repo.updateFood({ ...entry, healthSampleId: copy.id });
  return copy.result;
}

export async function deleteFood(repo: Repository, source: SampleWriter, entry: FoodEntry): Promise<HealthCopy> {
  await repo.deleteFood(entry.id);
  return removeCopy(entry.healthSampleId, sampleRemover(source, 'food'));
}

/** Saves a changed weight or water entry over the old one. */
export async function changeLog(
  repo: Repository,
  source: SampleWriter,
  kind: LogKind,
  before: LogEntry,
  after: LogEntry,
): Promise<HealthCopy> {
  const entry: LogEntry = { ...after, id: before.id, healthSampleId: before.healthSampleId };
  await repo.updateLog(kind, entry);
  const write = kind === 'weight' ? source.writeWeight : source.writeWater;
  const copy = await replaceCopy(
    before.healthSampleId,
    sampleRemover(source, kind),
    write ? () => write.call(source, entry.value, new Date(entry.loggedAt)) : undefined,
  );
  if (copy.id !== entry.healthSampleId) await repo.updateLog(kind, { ...entry, healthSampleId: copy.id });
  return copy.result;
}

export async function deleteLog(repo: Repository, source: SampleWriter, kind: LogKind, entry: LogEntry): Promise<HealthCopy> {
  await repo.deleteLog(kind, entry.id);
  return removeCopy(entry.healthSampleId, sampleRemover(source, kind));
}

/** Saves a changed reading typed in this app; readings from other apps are left alone. */
export async function changeBloodPressure(
  repo: Repository,
  vitals: BpWriter | null,
  before: BloodPressureEntry,
  after: BloodPressureEntry,
  now = Date.now(),
): Promise<HealthCopy> {
  if (before.source !== 'manual') return 'none';
  const entry: BloodPressureEntry = { ...after, id: before.id, source: 'manual', healthId: before.healthId, updatedAt: now };
  await repo.saveBloodPressure(entry);
  const copy = await replaceCopy(
    before.healthId,
    vitals ? (id) => vitals.deleteBloodPressure({ ...before, healthId: id }) : undefined,
    vitals ? () => vitals.writeBloodPressure(entry.systolic, entry.diastolic, new Date(entry.loggedAt)) : undefined,
  );
  if (copy.id !== entry.healthId) await repo.saveBloodPressure({ ...entry, healthId: copy.id });
  return copy.result;
}

/** Readings deleted here whose copy in Health Connect / Apple Health couldn't be deleted yet. */
const LEFT_COPIES_KEY = 'bpCopiesLeft';

export async function deleteBloodPressure(
  repo: Repository,
  vitals: BpWriter | null,
  entry: BloodPressureEntry,
): Promise<HealthCopy> {
  if (entry.source !== 'manual') return 'none';
  await repo.deleteBloodPressure(entry.id);
  const result = await removeCopy(entry.healthId, vitals ? (id) => vitals.deleteBloodPressure({ ...entry, healthId: id }) : undefined);
  if (result === 'failed') {
    // Kept so the next sync neither brings the copy back as a reading from another app nor stops trying to delete it.
    try {
      const left = (await repo.getKv<BloodPressureEntry[]>(LEFT_COPIES_KEY)) ?? [];
      if (!left.some((e) => e.healthId === entry.healthId)) await repo.setKv(LEFT_COPIES_KEY, [...left, entry]);
    } catch {
      // The reading is still deleted here; at worst its copy comes back with the next sync.
    }
  }
  return result;
}

/**
 * Tries again to delete the copies of readings deleted here, and returns
 * their ids, so a sync doesn't bring them back. One deleted now is dropped
 * from the list; the rest wait for the next sync.
 */
export async function retryLeftCopies(repo: Repository, vitals: Pick<BpWriter, 'deleteBloodPressure'> | null): Promise<Set<string>> {
  const left = (await repo.getKv<BloodPressureEntry[]>(LEFT_COPIES_KEY)) ?? [];
  if (!left.length) return new Set();
  const still: BloodPressureEntry[] = [];
  for (const entry of left) {
    try {
      if (!vitals) throw new Error('No health store');
      await vitals.deleteBloodPressure(entry);
    } catch {
      still.push(entry);
    }
  }
  if (still.length < left.length) await repo.setKv(LEFT_COPIES_KEY, still);
  // All of them: a copy deleted just now can still be in what the sync read before.
  return new Set(left.flatMap((e) => (e.healthId ? [e.healthId] : [])));
}

/** The id of the night someone logged for a morning; one per morning, so logging it again replaces it. */
export const manualNightId = (date: string) => `sleep-${date}`;

type NightTimes = Pick<SleepEntry, 'startAt' | 'endAt' | 'rested'> & { asleepMin?: number };

/**
 * Saves a night someone logged. Its morning comes from the wake-up time, so a
 * changed date moves it: the old morning's entry goes, and one already logged
 * for the new morning is replaced. A wake-up time left as it was keeps its
 * morning, even when the phone is now in another time zone.
 */
export async function saveNight(
  repo: Repository,
  before: SleepEntry | null,
  night: NightTimes,
  now = Date.now(),
): Promise<SleepEntry> {
  const date = before && night.endAt === before.endAt ? before.date : dayKey(new Date(night.endAt));
  const entry: SleepEntry = {
    id: manualNightId(date),
    date,
    startAt: night.startAt,
    endAt: night.endAt,
    asleepMin: night.asleepMin ?? Math.round((night.endAt - night.startAt) / 60_000),
    rested: night.rested,
    source: 'manual',
    healthId: null,
    stages: null,
    updatedAt: now,
  };
  await repo.saveSleep(entry);
  if (before && before.id !== entry.id) await repo.deleteSleep(before.id);
  return entry;
}

/**
 * Saves the "Last night" card. Times that still end this morning change this
 * morning's night (`saved`); times for another morning add a night for that
 * morning and leave this morning's alone. Moving a night is done from the list.
 */
export function saveLastNight(repo: Repository, saved: SleepEntry | null, night: NightTimes, now = Date.now()): Promise<SleepEntry> {
  const sameMorning = saved !== null && (night.endAt === saved.endAt || dayKey(new Date(night.endAt)) === saved.date);
  return saveNight(repo, sameMorning ? saved : null, night, now);
}

/**
 * Saves a mood. There's one per day, taken from its time, so a changed date
 * moves it: the old day's goes, and one already there for the new day is
 * replaced. A time left as it was keeps its day, even in another time zone.
 */
export async function saveMood(repo: Repository, before: MoodEntry | null, after: Omit<MoodEntry, 'date'>): Promise<MoodEntry> {
  const date = before && after.loggedAt === before.loggedAt ? before.date : dayKey(new Date(after.loggedAt));
  const entry: MoodEntry = { ...after, note: after.note?.trim() || null, date };
  await repo.setMood(entry);
  if (before && before.date !== entry.date) await repo.deleteMood(before.date);
  return entry;
}
