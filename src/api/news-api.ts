/**
 * GET /v1/news (stepsinfra steps/data/news.py): good-news headlines for the
 * ticker on Today, the same for everyone. Sent with the sign-in token like
 * every Steps API call; nothing about the person is sent.
 */
import { getAccessToken } from '@/auth/session';
import { STEPS_API_URL } from '@/constants/app';

import { type NewsItem, readNews } from './news-read';

export interface NewsDeps {
  fetch: typeof fetch;
  token: () => Promise<string>;
  baseUrl: string;
}

const defaults: NewsDeps = { fetch: (...a) => fetch(...a), token: getAccessToken, baseUrl: STEPS_API_URL };

const TIMEOUT_MS = 15_000;

/** The headlines, or null when they could not be had (offline, signed out, server error). */
export async function fetchNews(deps: NewsDeps = defaults): Promise<NewsItem[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = await deps.token();
    const res = await deps.fetch(`${deps.baseUrl}/v1/news`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return readNews(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
