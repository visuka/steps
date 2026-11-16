/**
 * "Walkers in your area": one low-accuracy fix while the app is in use, turned
 * into a 5 km area code on this phone. The coordinates are dropped here.
 */
import * as Location from 'expo-location';

import { locationAllowed, requestLocation } from '@/location/place';

import { geohash } from './geohash';

/** The area code, or null when location is refused or unavailable. `ask` shows the Android prompt. */
export async function currentArea(ask: boolean): Promise<string | null> {
  const allowed = ask ? await requestLocation() : await locationAllowed();
  if (!allowed) return null;
  try {
    const p =
      (await Location.getLastKnownPositionAsync({ maxAge: 3_600_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return geohash(p.coords.latitude, p.coords.longitude);
  } catch {
    return null;
  }
}
