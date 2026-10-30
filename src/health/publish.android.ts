import type { Repository } from '@/data/types';
import { addDaysToKey, dayKey } from '@/lib/dates';

import { healthConnectAvailable, publishHourlySteps } from './health-connect-source';
import type { StepSource } from './types';

/**
 * When the app counts steps itself, copy finished hours into Health Connect
 * so Google Fit, Samsung Health and others can see them.
 */
export async function publishStepsIfOwnCounter(repo: Repository, source: StepSource, now: Date): Promise<void> {
  if (source.id !== 'device-sensor' || !(await healthConnectAvailable())) return;
  const today = dayKey(now);
  for (const day of [addDaysToKey(today, -1), today]) {
    await publishHourlySteps(day, await repo.getHourly(day), now);
  }
}
