import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BloodPressureEntry, DaySummary, DayWeather, FoodEntry, HeartDay, MoodEntry, Walk } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, parseDayKey } from '@/lib/dates';
import { formatDistance, formatSteps, formatTemp } from '@/lib/format';
import {
  type Comparison,
  DAY_PARTS,
  describeChange,
  formatHourWindow,
  heatComparison,
  MIN_GROUP_DAYS,
  moodComparison,
  rainComparison,
  timeOfDay,
  weekendComparison,
} from '@/lib/insights';
import { formatSleep, type Night, nightsByDate } from '@/lib/sleep';
import { bpGoalComparison, restingTrend, sleepMoodComparison, sleepStepsComparison } from '@/lib/vitals-insights';
import { locationAllowed, requestLocation } from '@/location/place';
import { goodSources } from '@/nutrition/catalog';
import { dailyAverage, lowestNutrients } from '@/nutrition/day';
import { NUTRIENT } from '@/nutrition/nutrients';
import { useApp } from '@/state/app-state';
import { useFoodBook } from '@/state/use-food-book';
import { WEATHER_CREDIT } from '@/weather/refresh';

/** How far back patterns look. */
const WINDOW_DAYS = 60;
/** Nutrition looks at the last week, which is what people can still change. */
const FOOD_DAYS = 7;

interface Data {
  days: DaySummary[];
  hourly: number[][];
  moods: MoodEntry[];
  weather: DayWeather[];
  walks: Walk[];
  foods: FoodEntry[];
  nights: Night[];
  heart: HeartDay[];
  bp: BloodPressureEntry[];
}

/** What the person's own data says about when and in what conditions they walk. */
export function Patterns() {
  const { repo, profile, dataVersion, refresh } = useApp();
  const router = useRouter();
  const book = useFoodBook();
  const [data, setData] = useState<Data | null>(null);
  const [hasLocation, setHasLocation] = useState(true);
  const today = dayKey(new Date());

  useEffect(() => {
    let live = true;
    (async () => {
      const from = addDaysToKey(today, -WINDOW_DAYS);
      // Today is still in progress; it would drag every average down.
      const to = addDaysToKey(today, -1);
      const foodFrom = parseDayKey(addDaysToKey(today, -FOOD_DAYS)).getTime();
      const [days, hourly, moods, weather, walks, allowed, foods, sleep, heart, bp] = await Promise.all([
        repo.getDays(from, to),
        repo.getHourlyRange(from, to),
        repo.getMoods(from, to),
        repo.getWeatherRange(from, to),
        repo.getWalks(200),
        locationAllowed(),
        repo.getFoods(foodFrom, parseDayKey(today).getTime()),
        repo.getSleep(from, to),
        repo.getHeartDays(from, to),
        repo.getBloodPressure(parseDayKey(from).getTime(), parseDayKey(today).getTime()),
      ]);
      if (!live) return;
      setData({
        days,
        hourly: [...hourly.values()],
        moods,
        weather,
        walks: walks.filter((w) => dayKey(new Date(w.startedAt)) >= from),
        foods,
        nights: nightsByDate(sleep),
        heart,
        bp,
      });
      setHasLocation(allowed);
    })();
    return () => {
      live = false;
    };
  }, [repo, today, dataVersion]);

  if (!data) return null;

  const tod = timeOfDay(data.hourly);
  const weekend = weekendComparison(data.days);
  const mood = moodComparison(data.days, data.moods);
  const heat = heatComparison(data.days, data.weather);
  const rain = rainComparison(data.days, data.weather);
  const moodDays = data.moods.filter((m) => data.days.some((d) => d.date === m.date && d.steps > 0)).length;

  const nutrition = dailyAverage(data.foods, book.own, book.overrides);
  const low = nutrition.days >= MIN_GROUP_DAYS ? lowestNutrients(nutrition.average) : [];
  const sources = low[0] ? goodSources(low[0].key) : [];

  const sleepSteps = sleepStepsComparison(data.days, data.nights);
  const sleepMood = sleepMoodComparison(data.nights, data.moods);
  const resting = restingTrend(data.heart, data.days, today);
  const restingDays = data.heart.filter((h) => h.restingBpm !== null).length;
  const bpGoal = bpGoalComparison(data.days, data.bp);

  const places = new Map<string, number>();
  for (const w of data.walks) if (w.startPlace) places.set(w.startPlace, (places.get(w.startPlace) ?? 0) + 1);
  const topPlace = [...places].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <>
      <Card title="When you walk">
        {tod ? (
          <>
            <ThemedText>
              You walk most between <ThemedText type="smallBold">{formatHourWindow(tod.peakStartHour)}</ThemedText>.
            </ThemedText>
            <DayPartBars shares={tod.shares} />
            {weekend ? <ThemedText>{sentence('On weekends you walk', weekend, 'than on weekdays')}</ThemedText> : null}
          </>
        ) : (
          <Waiting text="Shows once there are a few days with hourly steps." />
        )}
      </Card>

      <Card title="Mood">
        {mood ? (
          <>
            <ThemedText>{sentence('On days you felt good or great, you walked', mood, 'than on other days')}</ThemedText>
            <Averages a={mood.a} b={mood.b} labelA="Good days" labelB="Other days" />
          </>
        ) : (
          <>
            <Waiting
              text={`Log your mood for a while to see this. It needs at least ${MIN_GROUP_DAYS} good days and ${MIN_GROUP_DAYS} other days; ${moodDays} logged so far.`}
            />
            <Button
              kind="secondary"
              label="Log today's mood"
              onPress={() => router.push({ pathname: '/journal', params: { section: 'mood' } })}
            />
          </>
        )}
      </Card>

      <Card title="Weather">
        {heat ? (
          <ThemedText>
            {sentence(`On days ${formatTemp(heat.thresholdC, profile.units)} or hotter, you walked`, heat.comparison, 'than on cooler days')}
          </ThemedText>
        ) : null}
        {rain ? <ThemedText>{sentence('On rainy days you walked', rain, 'than on dry days')}</ThemedText> : null}
        {!heat && !rain ? (
          hasLocation ? (
            <Waiting text={`Steps notes the weather each day you open it; ${data.weather.length} days so far.`} />
          ) : (
            <>
              <Waiting text="Allow location so Steps can note the weather in your area each day." />
              <Button
                kind="secondary"
                label="Allow location"
                onPress={async () => {
                  if (await requestLocation()) {
                    setHasLocation(true);
                    refresh();
                  }
                }}
              />
            </>
          )
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {WEATHER_CREDIT}.
        </ThemedText>
      </Card>

      <Card title="Nutrition, last week">
        {nutrition.days >= MIN_GROUP_DAYS ? (
          low.length ? (
            <>
              <ThemedText>Often low on days you logged food:</ThemedText>
              {low.map((l) => (
                <ThemedText key={l.key}>
                  · {NUTRIENT[l.key].label}: about {l.percent}% of the daily value
                </ThemedText>
              ))}
              {sources.length ? (
                <ThemedText themeColor="textSecondary">
                  Good sources of {NUTRIENT[low[0].key].label.replace(/^\w/, (c) => c.toLowerCase())}:{' '}
                  {sources.map((s) => s.food.name).join(', ')}.
                  {low[0].key === 'vitD' ? ' Sunlight on your skin is the biggest source of all.' : ''}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText>Your logged food covered every daily value we track. Nice.</ThemedText>
          )
        ) : (
          <>
            <Waiting
              text={`Log what you eat on ${MIN_GROUP_DAYS} days to see which nutrients run low; ${nutrition.days} so far this week.`}
            />
            <Button
              kind="secondary"
              label="Log food"
              onPress={() => router.push({ pathname: '/journal', params: { section: 'food' } })}
            />
          </>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Only counts what you log, so days with missed meals look lower than they were.
        </ThemedText>
      </Card>

      <Card title="Sleep">
        {sleepSteps ? (
          <>
            <ThemedText>{sentence('After nights of 7 hours or more, you walked', sleepSteps, 'than after shorter nights')}</ThemedText>
            <Averages a={sleepSteps.a} b={sleepSteps.b} labelA="After 7 h+" labelB="After less" />
          </>
        ) : null}
        {sleepMood ? (
          <ThemedText>
            Before days you felt good or great you slept {formatSleep(sleepMood.a)} on average; before other days,{' '}
            {formatSleep(sleepMood.b)}.
          </ThemedText>
        ) : null}
        {!sleepSteps && !sleepMood ? (
          <>
            <Waiting
              text={`Log your sleep for a while to see how it goes with your walking and mood; ${data.nights.length} ${data.nights.length === 1 ? 'night' : 'nights'} so far.`}
            />
            <Button
              kind="secondary"
              label="Log last night"
              onPress={() => router.push({ pathname: '/journal', params: { section: 'sleep' } })}
            />
          </>
        ) : null}
      </Card>

      <Card title="Heart rate">
        {resting ? (
          <>
            <ThemedText>
              Your resting heart rate averaged{' '}
              <ThemedText type="smallBold">{resting.recent} bpm</ThemedText> over the last two weeks, against{' '}
              {resting.earlier} bpm a month before.
            </ThemedText>
            {resting.recentSteps !== null && resting.earlierSteps !== null ? (
              <ThemedText themeColor="textSecondary">
                Your steps over the same weeks: {formatSteps(resting.recentSteps)} a day lately, against{' '}
                {formatSteps(resting.earlierSteps)} a month before.
              </ThemedText>
            ) : null}
          </>
        ) : (
          <>
            <Waiting
              text={
                restingDays
                  ? `This compares the last two weeks with a month before, so it needs about six weeks of resting heart rate; ${restingDays} days so far.`
                  : 'Heart rate comes from a watch or band. Connect it under Journal, Body, Heart.'
              }
            />
            {restingDays ? null : (
              <Button
                kind="secondary"
                label="Heart rate"
                onPress={() => router.push({ pathname: '/journal', params: { section: 'heart' } })}
              />
            )}
          </>
        )}
      </Card>

      <Card title="Blood pressure">
        {bpGoal ? (
          <ThemedText>
            On days you reached your step goal, your readings averaged{' '}
            <ThemedText type="smallBold">
              {bpGoal.goal.systolic}/{bpGoal.goal.diastolic}
            </ThemedText>
            ; on other days, {bpGoal.other.systolic}/{bpGoal.other.diastolic}.
          </ThemedText>
        ) : (
          <>
            <Waiting
              text={`Log readings on days you reach your goal and days you don't to compare them. It needs ${MIN_GROUP_DAYS} of each; ${data.bp.length} ${data.bp.length === 1 ? 'reading' : 'readings'} so far.`}
            />
            <Button
              kind="secondary"
              label="Log a reading"
              onPress={() => router.push({ pathname: '/journal', params: { section: 'bp' } })}
            />
          </>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Shows what goes together in your own numbers. It isn&apos;t medical advice; talk to your doctor about your
          blood pressure.
        </ThemedText>
      </Card>

      <Card title="Recorded walks">
        {data.walks.length ? (
          <>
            <ThemedText>
              {data.walks.length} walks in the last {WINDOW_DAYS} days,{' '}
              {formatDistance(
                data.walks.reduce((s, w) => s + w.distanceM, 0),
                profile.units,
              )}{' '}
              in all.
            </ThemedText>
            {topPlace ? <ThemedText>Most start around {topPlace}.</ThemedText> : null}
          </>
        ) : (
          <Waiting text="Record walks from the Walks tab to see where and how far you go." />
        )}
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        Patterns come from your last {WINDOW_DAYS} days and show what goes together, not what causes what.
      </ThemedText>
    </>
  );
}

function sentence(start: string, c: Comparison, end: string): string {
  const change = describeChange(c.change);
  return change === 'about the same' ? `${start} about the same as ${end.replace(/^than /, '')}.` : `${start} ${change} steps ${end}.`;
}

function Averages({ a, b, labelA, labelB }: { a: number; b: number; labelA: string; labelB: string }) {
  return (
    <View style={styles.averages}>
      <ThemedText type="small" themeColor="textSecondary">
        {labelA}: {formatSteps(a)} steps on average · {labelB}: {formatSteps(b)}
      </ThemedText>
    </View>
  );
}

function DayPartBars({ shares }: { shares: Record<string, number> }) {
  const theme = useTheme();
  const max = Math.max(...Object.values(shares), 0.01);
  return (
    <View style={styles.bars}>
      {DAY_PARTS.map(({ part, label }) => (
        <View key={part} style={styles.barRow}>
          <ThemedText type="small" style={styles.barLabel}>
            {label}
          </ThemedText>
          <View style={[styles.barTrack, { backgroundColor: theme.track }]}>
            <View style={[styles.barFill, { width: `${(shares[part] / max) * 100}%`, backgroundColor: theme.accent }]} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.barValue}>
            {Math.round(shares[part] * 100)}%
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function Waiting({ text }: { text: string }) {
  return <ThemedText themeColor="textSecondary">{text}</ThemedText>;
}

const styles = StyleSheet.create({
  averages: { gap: Spacing.half },
  bars: { gap: Spacing.two },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLabel: { width: 76 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barValue: { width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
