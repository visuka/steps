/**
 * Pinned places (Home, Office, Gym…) where people walk indoors. At a pin a
 * walk can record steps only, with no GPS, and switch to mapping the route
 * once the person leaves. The same rules run in the native service
 * (PlaceCheck.kt); keep the two in step.
 */
import { distanceM } from '@/lib/walk';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** 50, 100 or 150 m. */
  radiusM: number;
  /** What the person chose last time they started here, so the next start offers it first. */
  lastMode: 'indoor' | 'outside' | null;
  updatedAt: number;
}

export interface Fix {
  lat: number;
  lon: number;
  /** Accuracy, m; null when the phone didn't say. */
  acc: number | null;
}

export const PLACE_NAMES = ['Home', 'Office', 'Gym', "Friend's home"] as const;
export const PLACE_RADII = [50, 100, 150] as const;
export const DEFAULT_RADIUS_M = 100;

/** Accuracy slack: up to 50 m of a fix's uncertainty counts in its favour. */
const slack = (acc: number | null) => Math.min(acc ?? 50, 50);

/** The nearest pin the fix could be at (within radius + min(acc, 50)); `sure` while the fix is within 150 m. */
export function matchPlace(fix: Fix, places: Place[]): { place: Place; distanceM: number; sure: boolean } | null {
  let best: { place: Place; distanceM: number } | null = null;
  for (const place of places) {
    const d = distanceM(fix, place);
    if (d > place.radiusM + slack(fix.acc)) continue;
    if (!best || d < best.distanceM) best = { place, distanceM: d };
  }
  return best ? { ...best, sure: (fix.acc ?? Infinity) <= 150 } : null;
}

/**
 * Outside the pin: farther than radius + min(acc, 50) with acc <= 100, or so
 * far that even the whole accuracy can't reach it (a 300 m fix 5 km away).
 */
export function isOutside(fix: Fix, place: Pick<Place, 'lat' | 'lon' | 'radiusM'>): boolean {
  const d = distanceM(fix, place);
  const acc = fix.acc ?? 50;
  return (d > place.radiusM + slack(fix.acc) && acc <= 100) || d - acc > place.radiusM;
}

export type StartSuggestion =
  /** At the pin with a good fix: offer Indoor walk and Walk outside as two equal buttons, the last choice first. */
  | { kind: 'at'; place: Place; first: 'indoor' | 'outside' }
  /** Near a pin but the fix is rough: "Are you at Home?" */
  | { kind: 'unsure'; place: Place }
  /** No pin nearby, or no precise location to tell. */
  | { kind: 'none' }
  /** No pins yet: "Pin places you walk indoors". */
  | { kind: 'no-pins' };

/**
 * What the Record screen offers before starting. Indoor is suggested without
 * asking only with a precise location and a fix within 50 m; an approximate
 * location is 1-3 km off.
 */
export function suggestStart(fix: Fix | null, places: Place[], precise: boolean): StartSuggestion {
  if (!places.length) return { kind: 'no-pins' };
  if (!fix || !precise) return { kind: 'none' };
  const match = matchPlace(fix, places);
  if (!match) return { kind: 'none' };
  if (fix.acc !== null && fix.acc <= 50) return { kind: 'at', place: match.place, first: match.place.lastMode ?? 'indoor' };
  return match.sure ? { kind: 'unsure', place: match.place } : { kind: 'none' };
}

/** Pinning needs a precise location and a fix within 50 m. */
export function canPin(fix: Fix | null, precise: boolean): boolean {
  return !!fix && precise && fix.acc !== null && fix.acc <= 50;
}

/**
 * "Back at Home?": every fix of the last 2 minutes (at least 3) was inside
 * the pin. Going back indoors stays the person's choice; this only asks.
 */
export function backAtPlace(points: (Fix & { t: number })[], place: Place, now: number, holdS = 120): boolean {
  const recent = points.filter((p) => p.t >= now - holdS * 1000 && p.t <= now);
  if (recent.length < 3 || recent[0].t > now - (holdS - 15) * 1000) return false;
  return recent.every((p) => distanceM(p, place) <= place.radiusM + slack(p.acc));
}
