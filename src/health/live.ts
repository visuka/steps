import { Pedometer } from 'expo-sensors';

import type { LiveSample } from '@/lib/live-steps';

/**
 * Live step events while the app is open, as steps since the first event of
 * this subscription. The first event is only a baseline: on Android it can be
 * the sensor's cached last value, which expo reports as one step. Subscribe
 * again after the app comes back to the foreground, because on Android expo
 * keeps its old baseline across a pause and the first event after it would
 * include every step taken in the background.
 */
export function watchLiveSteps(onSample: (sample: LiveSample) => void): () => void {
  let subscription: { remove(): void } | null = null;
  let cancelled = false;
  let first: number | null = null;

  Pedometer.isAvailableAsync()
    .then(async (available) => {
      if (!available || cancelled) return;
      const { granted } = await Pedometer.getPermissionsAsync();
      if (!granted || cancelled) return;
      subscription = Pedometer.watchStepCount((r) => {
        first ??= r.steps;
        onSample({ at: Date.now(), count: r.steps - first });
      });
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    subscription?.remove();
  };
}

/** Motion & Fitness on iOS, physical activity on Android. */
export async function requestMotionPermission(): Promise<boolean> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    return (await Pedometer.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
