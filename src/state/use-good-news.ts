/**
 * Good-news headlines for the ticker on Today (owner, 16 Nov 2026: "fetch
 * some positive news ... some news scrolling section"). The last ones are
 * kept on the phone (kv `goodNews`), so the ticker shows at once and offline;
 * the server is asked again when they are over REFRESH_MS old. Any failure
 * keeps what is shown; with nothing ever fetched the ticker is not drawn.
 */
import { useEffect, useState } from 'react';

import { fetchNews } from '@/api/news-api';
import { type NewsItem, readSaved, type SavedNews } from '@/api/news-read';
import { previewLaunch } from '@/design-preview/launch';
import { useClock } from '@/hooks/use-clock';

import { useApp } from './app-state';

export type { NewsItem } from '@/api/news-read';

const KEY = 'goodNews';
/** The server reads its feeds every 3 hours; asking more often finds nothing new. */
const REFRESH_MS = 3 * 3600 * 1000;

/** Made-up headlines for the design preview (no sign-in, no network there). */
export const SAMPLE_NEWS: NewsItem[] = [
  { title: 'Village volunteers plant 10,000 trees along a dry riverbank', link: 'https://example.com/1', source: 'Sample news' },
  { title: 'Retired teacher opens a free reading room for children', link: 'https://example.com/2', source: 'Sample news' },
  { title: 'Rescued turtles return to the sea after a year of care', link: 'https://example.com/3', source: 'Sample news' },
];

// Shared by every Today in this run: switching tabs doesn't read the kv again.
let kept: SavedNews | null = null;

export function useGoodNews(): NewsItem[] {
  const { repo } = useApp();
  const preview = previewLaunch() !== null;
  const { now } = useClock();
  const [items, setItems] = useState<NewsItem[]>(() => (preview ? SAMPLE_NEWS : (kept?.items ?? [])));
  // Asked again each hour of the clock at most; the 3-hour rule below decides.
  const hour = Math.floor(now / 3600_000);

  useEffect(() => {
    if (preview) return;
    let live = true;
    (async () => {
      if (!kept) {
        kept = readSaved(await repo.getKv<unknown>(KEY).catch(() => null));
        if (live && kept) setItems(kept.items);
      }
      const at = hour * 3600_000;
      if (kept && at - kept.at < REFRESH_MS) return;
      const fresh = await fetchNews();
      if (!fresh?.length) return;
      kept = { at: Date.now(), items: fresh };
      repo.setKv(KEY, kept).catch(() => undefined);
      if (live) setItems(fresh);
    })();
    return () => {
      live = false;
    };
  }, [repo, preview, hour]);

  return items;
}
