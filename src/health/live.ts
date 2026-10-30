import { Pedometer } from 'expo-sensors';

/**
 * Live step events while the app is open. Reports steps since the call, which
 * the Today screen adds to the last synced total between syncs.
 */
export function watchLiveSteps(onSteps: (stepsSinceStart: number) => void): () => void {
  let subscription: { remove(): void } | null = null;
  let cancelled = false;

  Pedometer.isAvailableAsync()
    .then(async (available) => {
      if (!available || cancelled) return;
      const { granted } = await Pedometer.getPermissionsAsync();
      if (!granted || cancelled) return;
      subscription = Pedometer.watchStepCount((r) => onSteps(r.steps));
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
