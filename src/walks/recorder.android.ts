import { requestLocation } from '@/location/place';

import { StepCounter } from '../../modules/step-counter';
import type { WalkRecorder } from './recorder.types';

/** Android: the native walk service keeps recording with the screen off or the app closed. */
export const walkRecorder: WalkRecorder = {
  recordsInBackground: true,

  // Also resumes a walk whose recording was stopped by the system.
  async start() {
    if (!StepCounter) return null;
    if (!(await requestLocation())) return null;
    return StepCounter.startWalk();
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
    return StepCounter ? StepCounter.getWalkPoints(walkId, afterT) : [];
  },
  async discard(walkId) {
    await StepCounter?.clearWalk(walkId);
  },
};
