import { useEffect, useState } from 'react';

import { timeNow } from '@/lib/when';

/**
 * The time, refreshed every half minute: what an open form shows as "now"
 * (and the latest it lets you pick) stays current while it's open.
 */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(timeNow);
  useEffect(() => {
    const id = setInterval(() => setNow(timeNow()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
