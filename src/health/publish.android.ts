import { Platform } from 'react-native';

import type { Repository } from '@/data/types';
import { addDaysToKey, dayKey } from '@/lib/dates';

import { healthConnectAvailable, publishHourlySteps } from './health-connect-source';
import type { StepSource } from './types';

const PUBLISHED_KEY = 'stepsPublishedThrough';
/** Days re-sent at most, for when the app wasn't opened for a while. */
const MAX_DAYS = 7;

/**
 * When the phone itself is the source, copy finished hours into Health
 * Connect so Google Fit, Samsung Health and others can see them. Not on
 * Android 14 and later, where Health Connect counts the phone's steps itself:
 * a second copy would only be a duplicate. Untimed steps are in no hour, so
 * they're never copied.
 */
export async function publishStepsIfOwnCounter(repo: Repository, source: StepSource, now: Date): Promise<void> {
  if (source.id !== 'device-sensor' || (Platform.Version as number) >= 34 || !(await healthConnectAvailable())) return;
  const today = dayKey(now);
  const through = await repo.getKv<string>(PUBLISHED_KEY);
  let day = addDaysToKey(today, -1);
  if (through && through < day) day = through > addDaysToKey(today, -MAX_DAYS) ? through : addDaysToKey(today, -MAX_DAYS);
  for (; day <= today; day = addDaysToKey(day, 1)) {
    await publishHourlySteps(day, await repo.getHourly(day), now);
  }
  // Today isn't finished, so it's sent again next time.
  await repo.setKv(PUBLISHED_KEY, today);
}
