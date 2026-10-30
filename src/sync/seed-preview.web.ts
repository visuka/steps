/**
 * The web preview has demo steps but no location, weather or real walks. This
 * adds a month of sample moods and weather and a few walks, once, so every
 * screen and pattern can be reviewed in a browser.
 */
import { DEFAULT_PROFILE } from '@/data/profile';
import type { DayWeather, HeartDay, HourWeather, Mood, Repository, SleepEntry } from '@/data/types';
import { newId } from '@/data/types';
import { demoDaySteps } from '@/health/demo-source';
import { addDays, dayKey } from '@/lib/dates';
import { cleanPoints, walkActiveKcal, type WalkPoint, walkStats } from '@/lib/walk';
import { findFood, nutrientsFor } from '@/nutrition/catalog';
import { summarizeDay } from '@/weather/met';

const SEEDED_KEY = 'previewSeeded';
const VITALS_SEEDED_KEY = 'previewSeededVitals';
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
  // Its own flag, so previews seeded before sleep and heart existed get them too.
  await seedVitals(repo);
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

  const meals = [
    [8.2, 'idli', 'piece', 3],
    [8.25, 'sambar', 'bowl', 1],
    [11, 'chai', 'cup', 1],
    [13.5, 'chicken-biryani', 'plate', 1],
    [13.6, 'curd', 'bowl', 1],
    [16.75, 'samosa', 'piece', 1],
    [17, 'chai', 'cup', 1],
    [17.1, 'banana', 'piece', 1],
    [20.5, 'chapati', 'piece', 3],
    [20.5, 'dal', 'bowl', 1],
    [20.6, 'aloo-sabzi', 'bowl', 1],
  ] as const;
  for (let daysAgo = 4; daysAgo >= 0; daysAgo--) {
    const day = addDays(now, -daysAgo);
    const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    for (const [hour, foodId, unit, quantity] of meals) {
      // Skip a snack now and then so the days differ.
      if (daysAgo % 2 === 1 && foodId === 'samosa') continue;
      const at = midnight + Math.round(hour * 3_600_000);
      const food = findFood(foodId, []);
      if (at > now.getTime() || !food) continue;
      const { kcal = 0 } = nutrientsFor(food, unit, quantity, {});
      await repo.addFood({
        id: newId(),
        loggedAt: at,
        name: food.name,
        foodId,
        unit,
        quantity,
        kcal: Math.round(kcal),
        healthSampleId: null,
      });
    }
  }

  await repo.setKv(SEEDED_KEY, true);
}

/**
 * Seven weeks of resting heart rate easing down as walking picks up, a month
 * of nights (the last week as if from a watch, earlier ones typed in) and
 * blood pressure readings every other morning. Last night is left empty so
 * the entry form shows.
 */
async function seedVitals(repo: Repository) {
  if (await repo.getKv<boolean>(VITALS_SEEDED_KEY)) return;
  const now = new Date();
  const updatedAt = now.getTime();

  const heart: HeartDay[] = [];
  for (let i = 49; i >= 1; i--) {
    const resting = Math.round(67 + (i / 49) * 5 + (rand(i + 300) - 0.5) * 3);
    heart.push({
      date: dayKey(addDays(now, -i)),
      restingBpm: resting,
      avgBpm: resting + 13 + Math.round(rand(i + 400) * 6),
      minBpm: resting - 6,
      maxBpm: 118 + Math.round(rand(i + 500) * 30),
      updatedAt,
    });
  }
  await repo.upsertHeartDays(heart);

  for (let i = 30; i >= 1; i--) {
    const day = addDays(now, -i);
    const date = dayKey(day);
    const steps = demoDaySteps(date);
    // Fuller nights before busier days, loosely, as people often find.
    const asleepMin = Math.round(330 + (steps > 8000 ? 60 : 0) + rand(i + 600) * 70);
    const bedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 22, 30).getTime() + Math.round(rand(i + 700) * 6) * 15 * 60_000;
    const fromWatch = i <= 7;
    const awake = fromWatch ? 15 + Math.round(rand(i + 800) * 20) : 0;
    const endAt = bedAt + (asleepMin + awake) * 60_000;
    const entry: SleepEntry = {
      id: fromWatch ? `health:demo-${date}` : `sleep-${date}`,
      date,
      startAt: bedAt,
      endAt,
      asleepMin,
      rested: fromWatch ? null : ((asleepMin > 420 ? 4 : asleepMin > 380 ? 3 : 2) as Mood),
      source: fromWatch ? 'health' : 'manual',
      healthId: fromWatch ? `demo-${date}` : null,
      stages: fromWatch
        ? { awake, deep: Math.round(asleepMin * 0.17), rem: Math.round(asleepMin * 0.22), light: Math.round(asleepMin * 0.61) }
        : null,
      updatedAt,
    };
    await repo.saveSleep(entry);

    if (i % 2 === 0) {
      const goalDay = steps >= DEFAULT_PROFILE.dailyGoal;
      await repo.saveBloodPressure({
        id: newId(),
        loggedAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 40).getTime(),
        systolic: Math.round(131 - (goalDay ? 6 : 0) + (rand(i + 900) - 0.5) * 8),
        diastolic: Math.round(85 - (goalDay ? 3 : 0) + (rand(i + 950) - 0.5) * 6),
        pulse: 70 + Math.round(rand(i + 975) * 8),
        source: 'manual',
        healthId: null,
        updatedAt,
      });
    }
  }
  await repo.setKv(VITALS_SEEDED_KEY, true);
}
