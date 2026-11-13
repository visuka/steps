import type { RideEffort } from '@/lib/walk';
import { requestLocation } from '@/location/place';

import { StepCounter } from '../../modules/step-counter';
import { parsePlace, toArType, type WalkMode, type WalkRecorder } from './recorder.types';

const EFFORTS: RideEffort[] = ['easy', 'steady', 'hard'];

/** A missing native function (an older build) or a failed read never breaks the recording screen. */
async function safe<T>(read: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

/** Android: the native walk service keeps recording with the screen off or the app closed. */
export const walkRecorder: WalkRecorder = {
  recordsInBackground: true,

  // Also resumes a recording stopped by the system; the stored mode wins then.
  async start(options = {}) {
    if (!StepCounter) return null;
    const activity = options.activity ?? 'walk';
    const indoor = !!options.indoor;
    // An indoor ride has no GPS and no service.
    if (!(activity === 'ride' && indoor) && !(await requestLocation())) return null;
    return StepCounter.startWalk(
      activity,
      indoor,
      options.place ? JSON.stringify(options.place) : null,
      options.effort ?? null,
    );
  },
  async stop() {
    await StepCounter?.stopWalk();
  },
  async active() {
    return StepCounter?.activeWalk() ?? null;
  },
  async isRecording() {
    return StepCounter?.isWalkRecording() ?? false;
  },
  async points(walkId, afterT) {
    if (!StepCounter) return [];
    return (await StepCounter.getWalkPoints(walkId, afterT)).map((p) => ({
      t: p.t,
      lat: p.lat,
      lon: p.lon,
      acc: p.acc,
      speed: p.speed ?? null,
      speedAcc: p.speedAcc ?? null,
      alt: p.alt ?? null,
    }));
  },
  async steps(walkId, afterT) {
    return safe(() => StepCounter?.getWalkSteps(walkId, afterT) ?? [], []);
  },
  async pressure(walkId, afterT) {
    return safe(() => StepCounter?.getWalkPressure(walkId, afterT) ?? [], []);
  },
  async activities(walkId, afterT) {
    const rows = await safe(() => StepCounter?.getWalkActivity(walkId, afterT) ?? [], []);
    return rows.map((r) => ({ t: r.t, type: toArType(r.type), conf: r.conf }));
  },
  async mode() {
    const m = await safe(() => StepCounter?.walkMode() ?? null, null);
    if (!m) return null;
    const changes = m.changes.map((c) => ({ t: c.t, indoor: c.indoor })).sort((a, b) => a.t - b.t);
    const mode: WalkMode = {
      activity: m.activity === 'ride' ? 'ride' : 'walk',
      indoor: changes.length ? changes[0].indoor : m.indoor,
      indoorNow: m.indoor,
      place: parsePlace(m.place),
      effort: EFFORTS.includes(m.effort as RideEffort) ? (m.effort as RideEffort) : null,
      lastAliveAt: m.lastAliveAt,
      changes,
    };
    return mode;
  },
  async setIndoor(indoor) {
    await safe(() => StepCounter?.setWalkIndoor(indoor), undefined);
  },
  async hasBarometer() {
    return safe(() => StepCounter?.hasBarometer() ?? false, false);
  },
  async discard(walkId) {
    await StepCounter?.clearWalk(walkId);
  },
};
