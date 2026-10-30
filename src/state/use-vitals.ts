import { useEffect, useState } from 'react';

import { vitalsSource } from '@/health/vitals';
import { useApp } from '@/state/app-state';
import { connectVitals, vitalsConnected } from '@/sync/vitals-sync';

/** Whether sleep, heart rate and BP can be, and are, read from Apple Health / Health Connect. */
export function useVitalsConnection() {
  const { repo, dataVersion, touch } = useApp();
  const [state, setState] = useState<{ available: boolean; connected: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const available = vitalsSource ? await vitalsSource.isAvailable().catch(() => false) : false;
      const connected = await vitalsConnected(repo);
      if (live) setState({ available, connected });
    })();
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  const connect = async () => {
    const ok = await connectVitals(repo).catch(() => false);
    touch();
    return ok;
  };

  return {
    loading: state === null,
    available: state?.available ?? false,
    connected: state?.connected ?? false,
    label: vitalsSource?.label ?? null,
    connect,
  };
}
