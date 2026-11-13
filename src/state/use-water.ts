import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { LogEntry } from '@/data/types';
import { copyStore } from '@/health/select-source';
import { formatWater } from '@/lib/format';
import { addWater, undoWater } from '@/water/add';
import { loadWaterToday, snoozeWaterToday, type WaterToday } from '@/water/today';
import { waterProgressText } from '@/water/water';

import { useApp } from './app-state';

/** The steps extra changes every 3,000 steps; reading again every 1,000 is plenty. */
const STEP_BUCKET = 1000;

export interface AddedGlass {
  entry: LogEntry;
  /** For the snackbar: "Added 250 ml". */
  text: string;
}

/**
 * Today's water for the Today tile and the Food tab's water card, and the one
 * way both add a glass and undo it (water/add.ts).
 */
export function useWaterToday(enabled = true) {
  const { repo, source, profile, displaySteps, dataVersion, touch } = useApp();
  const [status, setStatus] = useState<WaterToday | null>(null);
  const steps = Math.floor(displaySteps / STEP_BUCKET) * STEP_BUCKET;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadWaterToday(repo, profile, new Date(), steps)
      .then((s) => live && setStatus(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [repo, profile, dataVersion, steps, enabled]);

  /** Adds `ml` (one glass by default). Null when the phone couldn't save it. */
  const add = useCallback(
    async (ml: number = profile.water.glassMl): Promise<AddedGlass | null> => {
      let added;
      try {
        added = await addWater(repo, source, ml);
      } catch {
        return null;
      }
      touch();
      const amount = formatWater(ml, profile.units);
      if (status?.target) {
        const total = status.waterMl + status.drinksMl + ml;
        AccessibilityInfo.announceForAccessibility(`Added. ${waterProgressText(total, status.target, profile.units)}`);
      }
      return {
        entry: added.entry,
        text: added.healthFailed ? `Added ${amount}, not copied to ${source.label}` : `Added ${amount}`,
      };
    },
    [repo, source, profile.water.glassMl, profile.units, status, touch],
  );

  const undo = useCallback(
    async (entry: LogEntry) => {
      try {
        // The copy is wherever it was saved, even if steps now come from somewhere else.
        await undoWater(repo, copyStore, entry);
      } finally {
        touch();
      }
    },
    [repo, touch],
  );

  const snooze = useCallback(async () => {
    await snoozeWaterToday(repo);
    setStatus((s) => (s ? { ...s, snoozed: true } : s));
  }, [repo]);

  return { status, add, undo, snooze };
}

export type WaterHook = ReturnType<typeof useWaterToday>;
