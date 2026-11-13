/**
 * The one way to add water ("+1 glass", the Journal's quick buttons) and to
 * undo it. Undo goes through data/entries.ts deleteLog, so the Health Connect
 * copy is removed too (repo.deleteLog alone would leave it behind).
 */
import { deleteLog, type HealthCopy, type SampleWriter } from '@/data/entries';
import { type LogEntry, newId, type Repository } from '@/data/types';

export interface AddedWater {
  entry: LogEntry;
  /** The phone has it, but the copy to Health Connect / Apple Health failed. */
  healthFailed: boolean;
}

/** Saves `ml` of water at `when`: Health Connect first (for its id), then the phone. */
export async function addWater(repo: Repository, source: SampleWriter, ml: number, when = new Date()): Promise<AddedWater> {
  let healthSampleId: string | null = null;
  let healthFailed = false;
  try {
    healthSampleId = (await source.writeWater?.(ml, when)) ?? null;
  } catch {
    healthFailed = true;
  }
  const entry: LogEntry = { id: newId(), loggedAt: when.getTime(), value: ml, healthSampleId };
  await repo.addLog('water', entry);
  return { entry, healthFailed };
}

/** Undo for the 5-second "Added 250 ml · Undo" snackbar. */
export function undoWater(repo: Repository, source: SampleWriter, entry: LogEntry): Promise<HealthCopy> {
  return deleteLog(repo, source, 'water', entry);
}
