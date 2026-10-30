/**
 * Periodic sync while the app is closed (Android WorkManager, iOS
 * BGTaskScheduler). The OS decides the real interval; 15 minutes is the floor.
 * Imported once from the root layout so the task is defined at startup.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { openRepository } from '@/data/db';
import { loadProfile } from '@/data/profile';
import type { SourceId } from '@/data/types';
import { getSource } from '@/health/select-source';

import { runSync } from './run';

const TASK = 'steps-background-sync';
export const SOURCE_KEY = 'sourceId';

TaskManager.defineTask(TASK, async () => {
  try {
    const repo = await openRepository();
    const profile = await loadProfile(repo);
    if (!profile.onboarded) return BackgroundTask.BackgroundTaskResult.Success;
    await runSync(repo, profile, getSource(await repo.getKv<SourceId>(SOURCE_KEY)));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  }
}
