/**
 * The good-news headlines (stepsinfra GET /v1/news), checked before they are
 * shown: a title, an https link and the site's name, at most MAX_NEWS. Pure,
 * so jest checks it without the network.
 */

export interface NewsItem {
  title: string;
  /** The story on its own site; opened in the browser. */
  link: string;
  /** "The Better India", "Good News Network". */
  source: string;
}

/** What the phone keeps (kv `goodNews`): the headlines and when they came. */
export interface SavedNews {
  at: number;
  items: NewsItem[];
}

export const MAX_NEWS = 10;
const TITLE_MAX = 200;
const SOURCE_MAX = 40;

function item(raw: unknown): NewsItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const { title, link, source } = raw as Record<string, unknown>;
  if (typeof title !== 'string' || typeof link !== 'string' || typeof source !== 'string') return null;
  const t = title.replace(/\s+/g, ' ').trim();
  const s = source.trim();
  if (!t || t.length > TITLE_MAX || !s || s.length > SOURCE_MAX || !/^https:\/\/[^\s]+$/.test(link)) return null;
  return { title: t, link, source: s };
}

/** The headlines in a /v1/news answer; [] for anything else. */
export function readNews(json: unknown): NewsItem[] {
  const items = json && typeof json === 'object' ? (json as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return [];
  return items.map(item).filter((x): x is NewsItem => x !== null).slice(0, MAX_NEWS);
}

/** The kept copy, or null when there is none or it is not ours. */
export function readSaved(raw: unknown): SavedNews | null {
  if (!raw || typeof raw !== 'object') return null;
  const at = (raw as { at?: unknown }).at;
  const items = readNews(raw);
  return typeof at === 'number' && Number.isFinite(at) && items.length ? { at, items } : null;
}
