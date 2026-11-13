/**
 * One position fix for the screens: where the person stands before a walk
 * starts (to offer an indoor walk at a pin) and for pinning a place. Never
 * asks for permission itself, and never throws.
 */
import * as Location from 'expo-location';

import type { Fix } from '@/lib/places';

const toFix = (loc: Location.LocationObject): Fix => ({
  lat: loc.coords.latitude,
  lon: loc.coords.longitude,
  acc: loc.coords.accuracy ?? null,
});

const within = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/** A last known fix under 2 minutes old, else a fresh one within `timeoutMs`; null when there's none. */
export async function quickFix(timeoutMs = 8000): Promise<Fix | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 100 });
    if (last) return toFix(last);
  } catch {
    // No last fix on this phone or in the web preview: ask for a fresh one.
  }
  return freshFix(timeoutMs);
}

/** A fresh, high-accuracy fix within `timeoutMs`; null on timeout or error. */
export async function freshFix(timeoutMs = 15_000): Promise<Fix | null> {
  try {
    const loc = await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), timeoutMs);
    return loc ? toFix(loc) : null;
  } catch {
    return null;
  }
}
