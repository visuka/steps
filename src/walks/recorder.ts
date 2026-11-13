/**
 * iOS and the web preview: follows the position while the app is on screen.
 * Recording in the background on iOS needs its own native code (a later step),
 * so the walk screen asks people to keep the app open there. Indoors there's
 * no location watch, and there are no step, pressure or activity samples.
 */
import * as Location from 'expo-location';

import type { ModeChange, WalkPoint } from '@/lib/walk';
import { requestLocation } from '@/location/place';

import type { RecordingPlace, WalkRecorder } from './recorder.types';

interface Current {
  walkId: number;
  points: WalkPoint[];
  subscription: Location.LocationSubscription | null;
  /** Its own flag: an indoor walk has no subscription but is still recording. */
  recording: boolean;
  activity: 'walk' | 'ride';
  place: RecordingPlace | null;
  effort: 'easy' | 'steady' | 'hard' | null;
  changes: ModeChange[];
}

let current: Current | null = null;

async function watch(walk: Current) {
  walk.subscription?.remove();
  walk.subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 2 },
    (loc) =>
      walk.points.push({
        t: loc.timestamp,
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        acc: loc.coords.accuracy ?? null,
        speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
        alt: loc.coords.altitude ?? null,
      }),
  );
}

const indoorNow = (walk: Current) => walk.changes[walk.changes.length - 1]?.indoor ?? false;

export const walkRecorder: WalkRecorder = {
  recordsInBackground: false,

  async start(options = {}) {
    if (current) {
      current.recording = true;
      if (!indoorNow(current) && !current.subscription) await watch(current);
      return current.walkId;
    }
    const activity = options.activity ?? 'walk';
    const indoor = !!options.indoor;
    if (!indoor && !(await requestLocation())) return null;
    const walkId = Date.now();
    const walk: Current = {
      walkId,
      points: [],
      subscription: null,
      recording: true,
      activity,
      place: options.place ?? null,
      effort: options.effort ?? null,
      changes: [{ t: walkId, indoor }],
    };
    current = walk;
    if (!indoor) await watch(walk);
    return walkId;
  },
  async stop() {
    current?.subscription?.remove();
    if (current) {
      current.subscription = null;
      current.recording = false;
    }
  },
  async active() {
    return current?.walkId ?? null;
  },
  async isRecording() {
    return !!current?.recording;
  },
  async points(walkId, afterT) {
    return current?.walkId === walkId ? current.points.filter((p) => p.t > afterT) : [];
  },
  async steps() {
    return [];
  },
  async pressure() {
    return [];
  },
  async activities() {
    return [];
  },
  async mode() {
    if (!current) return null;
    return {
      activity: current.activity,
      indoor: current.changes[0]?.indoor ?? false,
      indoorNow: indoorNow(current),
      place: current.place,
      effort: current.effort,
      lastAliveAt: current.points[current.points.length - 1]?.t ?? null,
      changes: [...current.changes],
    };
  },
  async setIndoor(indoor) {
    const walk = current;
    if (!walk || indoorNow(walk) === indoor || walk.activity === 'ride') return;
    walk.changes.push({ t: Date.now(), indoor });
    if (indoor) {
      walk.subscription?.remove();
      walk.subscription = null;
    } else if (walk.recording && (await requestLocation())) {
      await watch(walk);
    }
  },
  async hasBarometer() {
    return false;
  },
  async discard(walkId) {
    if (current?.walkId !== walkId) return;
    current.subscription?.remove();
    current = null;
  },
};
