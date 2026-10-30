import type { SourceId } from '@/data/types';

import { deviceSensorSource, ensureCounterRunning } from './device-sensor-source';
import { healthConnectSource, hasStepsFromOtherApps } from './health-connect-source';
import type { StepSource } from './types';

export function getSource(id: SourceId | null): StepSource {
  return id === 'device-sensor' ? deviceSensorSource : healthConnectSource;
}

/**
 * Health Connect first: if another app already records steps there, read
 * them. Otherwise count with the phone's own sensor.
 */
export async function setupSource(): Promise<StepSource> {
  if (await healthConnectSource.isAvailable()) {
    const granted = await healthConnectSource.requestPermissions();
    if (granted && (await hasStepsFromOtherApps().catch(() => false))) return healthConnectSource;
  }
  if ((await deviceSensorSource.isAvailable()) && (await deviceSensorSource.requestPermissions())) {
    return deviceSensorSource;
  }
  return healthConnectSource;
}

export async function switchableSources(): Promise<StepSource[]> {
  const sources: StepSource[] = [];
  if (await healthConnectSource.isAvailable()) sources.push(healthConnectSource);
  if (await deviceSensorSource.isAvailable()) sources.push(deviceSensorSource);
  return sources;
}

export async function onAppStart(source: StepSource): Promise<void> {
  if (source.id === 'device-sensor') await ensureCounterRunning().catch(() => undefined);
}
