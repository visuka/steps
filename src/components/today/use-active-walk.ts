/** The walk being recorded, if any: its start, and the distance so far, read again every 15 s. */

import { useEffect, useState } from 'react';

import { cleanPoints, walkStats } from '@/lib/walk';
import { walkRecorder } from '@/walks/recorder';

const POLL_MS = 15_000;

export interface ActiveWalk {
  /** Start time (epoch ms): the recording's id. */
  startedAt: number;
  /** Seconds since the start, at the last read. */
  elapsedS: number;
  /** Metres so far; null with fewer than two fixes (an indoor walk has none). */
  distanceM: number | null;
}

/** `reload` reads again (pass the count that goes up each time Today comes into view). */
export function useActiveWalk(reload: number): ActiveWalk | null {
  const [walk, setWalk] = useState<ActiveWalk | null>(null);

  useEffect(() => {
    let live = true;
    const read = async () => {
      try {
        const id = await walkRecorder.active();
        if (!live) return;
        if (id === null) {
          setWalk(null);
          return;
        }
        const points = cleanPoints(await walkRecorder.points(id, 0));
        if (!live) return;
        setWalk({
          startedAt: id,
          elapsedS: Math.max(0, (Date.now() - id) / 1000),
          distanceM: points.length < 2 ? null : walkStats(points).distanceM,
        });
      } catch {
        // Keep the last reading; the card still opens the walk.
      }
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [reload]);

  return walk;
}
