import { useEffect, useState } from 'react';

import { StepCounter } from '../../modules/step-counter';
import { hourStart, loadHourMinutes, type MinuteRow } from './minute-detail';

export interface HourMinutes {
  rows: MinuteRow[];
  loading: boolean;
}

/**
 * The minutes of one hour of today (`hour` 0 to 23; null = none opened), read
 * from the native counters. Reads again when `refreshKey` changes (a sync).
 * Empty without the native module (web, iOS).
 */
export function useHourMinutes(hour: number | null, refreshKey: unknown): HourMinutes {
  const [state, setState] = useState<HourMinutes & { hour: number | null }>({ rows: [], loading: false, hour: null });

  useEffect(() => {
    if (hour === null || !StepCounter) return;
    let live = true;
    loadHourMinutes(StepCounter, hourStart(hour))
      .then((rows) => live && setState({ rows, loading: false, hour }))
      .catch(() => live && setState({ rows: [], loading: false, hour }));
    return () => {
      live = false;
    };
  }, [hour, refreshKey]);

  // Until this hour's read arrives, a different hour's rows must not show under it.
  if (hour === null || !StepCounter) return { rows: [], loading: false };
  if (state.hour !== hour) return { rows: [], loading: true };
  return { rows: state.rows, loading: state.loading };
}
