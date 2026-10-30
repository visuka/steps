/**
 * Fetches today's weather for the phone's approximate area while the app is
 * open. MET Norway's rules: identify the app, round coordinates, don't ask again
 * before the response expires, and never fetch while the app isn't in use, so
 * this runs only from the foreground sync, never the background task.
 */
import * as Location from 'expo-location';

import type { Repository } from '@/data/types';
import { dayKey } from '@/lib/dates';
import { locationAllowed, placeName } from '@/location/place';

import { hoursForDay, type MetForecast, summarizeDay } from './met';

const ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const USER_AGENT = 'NeutcraftsSteps/1.0 github.com/visuka/steps';
const NEXT_FETCH_KEY = 'weatherNextFetchAt';
const PLACE_KEY = 'weatherPlace';
/** Even if the response expires sooner, a day's weather doesn't need more than this. */
const MIN_INTERVAL_MS = 2 * 3_600_000;

/** About 1 km: plenty for weather, and the area isn't pinpointed in the request. */
const round = (deg: number) => Math.round(deg * 100) / 100;

export const WEATHER_CREDIT = 'Weather data from MET Norway';

/** Resolves true when today's weather was updated. */
export async function refreshWeather(repo: Repository, now = new Date()): Promise<boolean> {
  if (!(await locationAllowed())) return false;
  const nextAt = await repo.getKv<number>(NEXT_FETCH_KEY);
  if (nextAt && now.getTime() < nextAt) return false;

  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 3 * 3_600_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  const lat = round(position.coords.latitude);
  const lon = round(position.coords.longitude);

  const res = await fetch(`${ENDPOINT}?lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    // 429 or 5xx: back off rather than retrying on every app open.
    await repo.setKv(NEXT_FETCH_KEY, now.getTime() + MIN_INTERVAL_MS);
    return false;
  }
  const forecast = (await res.json()) as MetForecast;
  const expires = Date.parse(res.headers.get('Expires') ?? '');
  await repo.setKv(NEXT_FETCH_KEY, Math.max(now.getTime() + MIN_INTERVAL_MS, Number.isNaN(expires) ? 0 : expires));

  const place = await areaName(repo, lat, lon);
  const date = dayKey(now);
  const previous = await repo.getWeather(date);
  const summary = summarizeDay(date, hoursForDay(forecast, date, previous?.hours ?? {}), place, now.getTime());
  if (!summary) return false;
  await repo.upsertWeather(summary);
  return true;
}

/** Looks the area up only when the rounded position changed. */
async function areaName(repo: Repository, lat: number, lon: number): Promise<string | null> {
  const cached = await repo.getKv<{ lat: number; lon: number; name: string | null }>(PLACE_KEY);
  if (cached && cached.lat === lat && cached.lon === lon) return cached.name;
  const name = await placeName(lat, lon);
  await repo.setKv(PLACE_KEY, { lat, lon, name });
  return name;
}
