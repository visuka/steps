/**
 * Pinned places: creating a pin where the person stands, and remembering
 * whether they last started there indoors or outside.
 */
import type { Repository } from '@/data/types';
import { newId } from '@/data/types';
import { canPin, DEFAULT_RADIUS_M, type Fix, type Place } from '@/lib/places';

/** A new pin at the fix, or null when the fix is too rough to pin (needs precise location and 50 m). */
export function newPlace(name: string, fix: Fix | null, precise: boolean, radiusM: number = DEFAULT_RADIUS_M): Place | null {
  if (!canPin(fix, precise) || !fix) return null;
  const clean = name.trim().slice(0, 40);
  if (!clean) return null;
  return { id: newId(), name: clean, lat: fix.lat, lon: fix.lon, radiusM, lastMode: null, updatedAt: Date.now() };
}

/** Saves which button the person chose at this pin, so the next start offers it first. */
export async function rememberStartMode(repo: Repository, place: Place, mode: 'indoor' | 'outside'): Promise<void> {
  if (place.lastMode === mode) return;
  await repo.savePlace({ ...place, lastMode: mode, updatedAt: Date.now() });
}
