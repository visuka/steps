import type { SourceId } from '@/data/types';

import { healthKitSource } from './healthkit-source';
import type { StepSource } from './types';

export function getSource(_id: SourceId | null): StepSource {
  return healthKitSource;
}

export async function setupSource(): Promise<StepSource> {
  await healthKitSource.requestPermissions();
  return healthKitSource;
}

export async function switchableSources(): Promise<StepSource[]> {
  return [];
}

export async function onAppStart(_source: StepSource): Promise<void> {}
