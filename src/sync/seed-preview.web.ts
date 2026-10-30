/**
 * The web preview has demo steps but no location, weather or real walks. This
 * adds a month of sample moods and weather and a few walks, once, so every
 * screen and pattern can be reviewed in a browser.
 */
import { DEFAULT_PROFILE } from '@/data/profile';
import type { DayWeather, HourWeather, Mood, Repository } from '@/data/types';
import { newId } from '@/data/types';
import { demoDaySteps } from '@/health/demo-source';
import { addDays, dayKey } from '@/lib/dates';
import { cleanPoints, walkActiveKcal, type WalkPoint, walkStats } from '@/lib/walk';
import { summarizeDay } from '@/weather/met';

const SEEDED_KEY = 'previewSeeded';
const PLACE = 'Indiranagar';
const HOME = { lat: 12.9719, lon: 77.6412 };
const METRES_PER_DEGREE = 111_195;

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function sampleWeather(date: string, seed: number, now: number): DayWeather | null {
  const hot = 27 + rand(seed) * 10;
  const rainy = rand(seed + 1) < 0.25;
  const hours: Record<number, HourWeather> = {};
  for (let h = 0; h < 24; h++) {
    const warmth = Math.max(0, Math.sin(((h - 6) / 24) * 2 * Math.PI));
    const rainHour = rainy && h >= 15 && h <= 18;
    hours[h] = {
      tempC: Math.round((hot - 9 + 9 * warmth) * 10) / 10,
      precipMm: rainHour ? 1.5 : 0,
      symbol: rainHour ? 'rainshowers_day' : h >= 7 && h <= 18 ? (rand(seed + h) < 0.5 ? 'clearsky_day' : 'partlycloudy_day') : 'clearsky_night',
    };
  }
  return summarizeDay(date, hours, PLACE, now);
}

/** A loop of `minutes` around a block near home, one fix every 2 s at a brisk pace. */
function sampleRoute(start: number, minutes: number, seed: number): WalkPoint[] {
  const speed = 1.25 + rand(seed) * 0.35;
  const width = 300 + rand(seed + 1) * 400;
  const height = 200 + rand(seed + 2) * 300;
  const perimeter = 2 * (width + height);
  const points: WalkPoint[] = [];
  for (let s = 0; s <= minutes * 60; s += 2) {
    let d = (s * speed) % perimeter;
    let x = 0;
    let y = 0;
    if (d < width) x = d;
    else if ((d -= width) < height) [x, y] = [width, d];
    else if ((d -= height) < width) [x, y] = [width - d, height];
    else [x, y] = [0, height - (d - width)];
    const jitter = (rand(seed + s) - 0.5) * 4;
    points.push({
      t: start + s * 1000,
      lat: HOME.lat + (y + jitter) / METRES_PER_DEGREE,
      lon: HOME.lon + (x + jitter) / (METRES_PER_DEGREE * Math.cos((HOME.lat * Math.PI) / 180)),
      acc: 6,
    });
  }
  return points;
}

export async function seedPreview(repo: Repository): Promise<void> {
  if (await repo.getKv<boolean>(SEEDED_KEY)) return;
  const now = new Date();

  for (let i = 30; i >= 0; i--) {
    const day = addDays(now, -i);
    const date = dayKey(day);
    const weather = sampleWeather(date, i, now.getTime());
    if (weather) await repo.upsertWeather(weather);
    if (i === 0) continue;
    // Moods loosely follow the demo steps, with some noise, like real life.
    const steps = demoDaySteps(date);
    const base = steps > 9000 ? 5 : steps > 7000 ? 4 : steps > 5000 ? 3 : 2;
    const mood = Math.min(5, Math.max(1, base + (rand(i + 50) < 0.2 ? -1 : 0))) as Mood;
    await repo.setMood({ date, mood, note: null, loggedAt: day.getTime() });
  }

  for (const [daysAgo, hour, minutes] of [
    [1, 18, 32],
    [3, 7, 25],
    [5, 18, 41],
    [8, 17, 28],
    [12, 6, 35],
  ] as const) {
    const day = addDays(now, -daysAgo);
    const startedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 10).getTime();
    const points = cleanPoints(sampleRoute(startedAt, minutes, daysAgo));
    const stats = walkStats(points);
    const weather = await repo.getWeather(dayKey(day));
    await repo.saveWalk(
      {
        id: newId(),
        startedAt,
        endedAt: startedAt + minutes * 60_000,
        distanceM: stats.distanceM,
        movingS: stats.movingS,
        steps: Math.round(stats.distanceM / 0.7),
        activeKcal: walkActiveKcal(stats.segments, DEFAULT_PROFILE.weightKg),
        startPlace: PLACE,
        weather: weather ? { tempC: weather.tempMaxC - 3, condition: weather.condition } : null,
        updatedAt: startedAt,
      },
      points,
    );
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const [hour, name, kcal] of [
    [8.2, 'Idli and sambar', 280],
    [11, 'Masala chai', 90],
    [13.5, 'Chicken biryani', 650],
    [16.75, 'Samosa', 260],
    [17, 'Masala chai', 90],
  ] as const) {
    const at = today.getTime() + Math.round(hour * 3_600_000);
    if (at > now.getTime()) continue;
    await repo.addFood({ id: newId(), loggedAt: at, name, kcal, healthSampleId: null });
  }

  await repo.setKv(SEEDED_KEY, true);
}
