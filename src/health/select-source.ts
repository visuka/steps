/**
 * Web build (and the type-checking default): there are no sensors or health
 * platforms, so the preview runs on demo data. iOS and Android have their own
 * select-source.<platform>.ts.
 */
import type { SourceId } from '@/data/types';

import { demoSource } from './demo-source';
import type { StepSource } from './types';

export function getSource(_id: SourceId | null): StepSource {
  return demoSource;
}

/** Asks for permissions and returns the source to use. */
export async function setupSource(): Promise<StepSource> {
  return demoSource;
}

/** Sources the user can switch between in Settings. */
export async function switchableSources(): Promise<StepSource[]> {
  return [];
}

/** Platform housekeeping on app start (e.g. restarting Android's counter). */
export async function onAppStart(_source: StepSource): Promise<void> {}
