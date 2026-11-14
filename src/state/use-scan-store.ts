import { useCallback, useEffect, useRef, useState } from 'react';

import {
  dropQueued,
  linkOwn,
  OWN_KEY,
  type OwnByCode,
  queueCode,
  QUEUE_KEY,
  readOwnByCode,
  readQueue,
  readRecent,
  RECENT_KEY,
  type RecentScan,
  rememberScan,
} from '@/nutrition/scan-cache';

import { useApp } from './app-state';

/**
 * What the phone keeps about scans (nutrition/scan-cache.ts), in the kv
 * table: recent products for offline use, codes to look up when back online,
 * and the own foods made from codes. Writes never fail the scan itself.
 */
export function useScanStore() {
  const { repo } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [own, setOwn] = useState<OwnByCode>({});
  // The latest lists for async work, so two quick saves don't undo each other.
  const lists = useRef<{ recent: RecentScan[]; queue: string[]; own: OwnByCode }>({ recent: [], queue: [], own: {} });

  useEffect(() => {
    let live = true;
    Promise.all([repo.getKv<unknown>(RECENT_KEY), repo.getKv<unknown>(QUEUE_KEY), repo.getKv<unknown>(OWN_KEY)])
      .then(([r, q, o]) => {
        if (!live) return;
        lists.current = { recent: readRecent(r), queue: readQueue(q), own: readOwnByCode(o) };
        setQueue(lists.current.queue);
        setOwn(lists.current.own);
      })
      .catch(() => undefined)
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [repo]);

  const write = (key: string, value: unknown) => repo.setKv(key, value).catch(() => undefined);

  return {
    loaded,
    queue,
    own,
    recent: useCallback((gtin: string) => lists.current.recent.find((s) => s.gtin === gtin) ?? null, []),
    remember: (scan: RecentScan) => {
      lists.current.recent = rememberScan(lists.current.recent, scan);
      return write(RECENT_KEY, lists.current.recent);
    },
    enqueue: (gtin: string) => {
      lists.current.queue = queueCode(lists.current.queue, gtin);
      setQueue(lists.current.queue);
      return write(QUEUE_KEY, lists.current.queue);
    },
    dequeue: (gtin: string) => {
      lists.current.queue = dropQueued(lists.current.queue, gtin);
      setQueue(lists.current.queue);
      return write(QUEUE_KEY, lists.current.queue);
    },
    linkOwn: (gtin: string, ownId: string) => {
      lists.current.own = linkOwn(lists.current.own, gtin, ownId);
      setOwn(lists.current.own);
      return write(OWN_KEY, lists.current.own);
    },
  };
}

export type ScanStore = ReturnType<typeof useScanStore>;
