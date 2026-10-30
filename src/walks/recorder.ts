/**
 * iOS and the web preview: follows the position while the app is on screen.
 * Recording in the background on iOS needs its own native code (a later step),
 * so the walk screen asks people to keep the app open there.
 */
import * as Location from 'expo-location';

import type { WalkPoint } from '@/lib/walk';
import { requestLocation } from '@/location/place';

import type { WalkRecorder } from './recorder.types';

let current: { walkId: number; points: WalkPoint[]; subscription: Location.LocationSubscription | null } | null =
  null;

export const walkRecorder: WalkRecorder = {
  recordsInBackground: false,

  async start() {
    if (current) return current.walkId;
    if (!(await requestLocation())) return null;
    const walk = { walkId: Date.now(), points: [] as WalkPoint[], subscription: null as Location.LocationSubscription | null };
    current = walk;
    walk.subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 2 },
      (loc) =>
        walk.points.push({
          t: loc.timestamp,
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          acc: loc.coords.accuracy ?? null,
        }),
    );
    return walk.walkId;
  },
  async stop() {
    current?.subscription?.remove();
    if (current) current.subscription = null;
  },
  async active() {
    return current?.walkId ?? null;
  },
  async isRecording() {
    return !!current?.subscription;
  },
  async points(walkId, afterT) {
    return current?.walkId === walkId ? current.points.filter((p) => p.t > afterT) : [];
  },
  async discard(walkId) {
    if (current?.walkId !== walkId) return;
    current.subscription?.remove();
    current = null;
  },
};
