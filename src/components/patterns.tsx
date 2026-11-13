import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice, TickBar, Why } from '@/components/ui';
import { NumeralMaxScale, Spacing } from '@/constants/theme';
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
import { dailyAverage, lowestNutrients, overLimits } from '@/nutrition/day';
import { eatingOut, MEAL_MIN_KCAL, MIN_MEALS } from '@/nutrition/eating-out';
import { formatNutrient, NUTRIENT } from '@/nutrition/nutrients';
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

  const nutrition = dailyAverage(data.foods, book.own, book.overrides, book.saved);
  const low = nutrition.days >= MIN_GROUP_DAYS ? lowestNutrients(nutrition.average) : [];
  const over = nutrition.days >= MIN_GROUP_DAYS ? overLimits(nutrition.average) : [];
  const sources = low[0] ? goodSources(low[0].key) : [];
  const out = eatingOut(data.foods, book.nutrientsOf);

  const sleepSteps = sleepStepsComparison(data.days, data.nights);
  const sleepMood = sleepMoodComparison(data.nights, data.moods);
  const resting = restingTrend(data.heart, data.days, today);
  const restingDays = data.heart.filter((h) => h.restingBpm !== null).length;
  const bpGoal = bpGoalComparison(data.days, data.bp);

  const places = new Map<string, number>();
  for (const w of data.walks) if (w.startPlace) places.set(w.startPlace, (places.get(w.startPlace) ?? 0) + 1);
  const topPlace = [...places].sort((a, b) => b[1] - a[1])[0]?.[0];
  const journal = (section: string) => router.navigate({ pathname: '/journal', params: { section } });

  return (
    <>
      <Insight title="When you walk">
        {tod ? (
          <>
            <Fact value={formatHourWindow(tod.peakStartHour).replace(' and ', '–')} label="your busiest hours" />
            <DayPartBars shares={tod.shares} />
            {weekend ? <ThemedText type="bodyMedium">Weekends: {versus(weekend, 'weekdays')}</ThemedText> : null}
          </>
        ) : (
          <Waiting text="Needs a few days with hourly steps." />
        )}
      </Insight>

      <Insight title="Mood">
        {mood ? (
          <>
            <Pair a={mood.a} b={mood.b} labelA="Good days" labelB="Other days" />
            <ThemedText type="bodyMedium">Good or great days: {versus(mood, 'other days')}</ThemedText>
          </>
        ) : (
          <Waiting
            text={`Needs ${MIN_GROUP_DAYS} good days and ${MIN_GROUP_DAYS} others. ${moodDays} logged so far.`}
            action={{ label: "Log today's mood", onPress: () => journal('mood') }}
          />
        )}
      </Insight>

      <Insight title="Weather" why={`${WEATHER_CREDIT}.`}>
        {heat ? (
          <ThemedText type="bodyMedium">
            {formatTemp(heat.thresholdC, profile.units)} or hotter: {versus(heat.comparison, 'cooler days')}
          </ThemedText>
        ) : null}
        {rain ? <ThemedText type="bodyMedium">Rainy days: {versus(rain, 'dry days')}</ThemedText> : null}
        {!heat && !rain ? (
          hasLocation ? (
            <Waiting text={`The weather is noted each day you open the app. ${data.weather.length} days so far.`} />
          ) : (
            <Waiting
              text="Allow location to note your area's weather each day."
              action={{
                label: 'Allow location',
                onPress: async () => {
                  if (await requestLocation()) {
                    setHasLocation(true);
                    refresh();
                  }
                },
              }}
            />
          )
        ) : null}
      </Insight>

      <Insight
        title="Nutrition, last week"
        why="Only counts what you log, so days with missed meals look lower than they were.">
        {nutrition.days >= MIN_GROUP_DAYS ? (
          low.length ? (
            <>
              <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
                Often low, share of the daily value
              </ThemedText>
              {low.map((l) => (
                <Meter key={l.key} label={NUTRIENT[l.key].label} percent={l.percent} />
              ))}
              {sources.length ? (
                <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
                  Good for {lowerFirst(NUTRIENT[low[0].key].label)}: {sources.map((s) => s.food.name).join(', ')}
                  {low[0].key === 'vitD' ? '; sunlight most of all' : ''}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <Notice tone="done" text="Your logged food covered every daily value we track." />
          )
        ) : null}
        {over.length ? (
          <>
            <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
              Over the advised limit, on average
            </ThemedText>
            {over.map((o) => (
              <Meter key={o.key} label={NUTRIENT[o.key].label} percent={o.percent} over />
            ))}
          </>
        ) : null}
        {nutrition.days < MIN_GROUP_DAYS ? (
          <Waiting
            text={`Needs food logged on ${MIN_GROUP_DAYS} days. ${nutrition.days} so far this week.`}
            action={{
              label: 'Log food',
              onPress: () => router.navigate({ pathname: '/food', params: { add: String(Date.now()) } }),
            }}
          />
        ) : null}
      </Insight>

      <Insight
        title="Eating out, last week"
        why={`Eaten out means dine-in or ordered in. Restaurant food often has more oil, ghee, butter and salt, and bigger portions, than the same dish made at home. A meal here is ${MEAL_MIN_KCAL} kcal or more logged within an hour from one place; tea and snacks under that aren't counted. This shows your own logged meals, not a verdict on any of them.`}>
        {out.out + out.home ? (
          <View style={styles.tiles}>
            <Figure label="Eaten out" value={String(out.out)} unit={out.out === 1 ? 'meal' : 'meals'} />
            <Figure label="Home-made" value={String(out.home)} unit={out.home === 1 ? 'meal' : 'meals'} />
          </View>
        ) : null}
        {out.averages.length ? (
          <>
            <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
              A meal, on average: out · home
            </ThemedText>
            {out.averages.map((a) => (
              <View key={a.key} style={styles.line}>
                <ThemedText type="bodyMedium" style={styles.flex}>
                  {NUTRIENT[a.key].label}
                </ThemedText>
                <ThemedText type="labelLarge" style={styles.figure}>
                  {formatNutrient(a.key, a.out)} · {formatNutrient(a.key, a.home)}
                </ThemedText>
              </View>
            ))}
          </>
        ) : (
          <Waiting text={`Needs ${MIN_MEALS} meals out and ${MIN_MEALS} home-made in a week. Tap where food was from when you add it.`} />
        )}
      </Insight>

      <Insight title="Sleep">
        {sleepSteps ? (
          <>
            <Pair a={sleepSteps.a} b={sleepSteps.b} labelA="After 7 h+" labelB="After less" />
            <ThemedText type="bodyMedium">After 7 hours or more: {versus(sleepSteps, 'shorter nights')}</ThemedText>
          </>
        ) : null}
        {sleepMood ? (
          <View style={styles.tiles}>
            <Figure label="Before good days" value={formatSleep(sleepMood.a)} />
            <Figure label="Before other days" value={formatSleep(sleepMood.b)} />
          </View>
        ) : null}
        {!sleepSteps && !sleepMood ? (
          <Waiting
            text={`Log your sleep for a while. ${data.nights.length} ${data.nights.length === 1 ? 'night' : 'nights'} so far.`}
            action={{ label: 'Log last night', onPress: () => journal('sleep') }}
          />
        ) : null}
      </Insight>

      <Insight
        title="Heart rate"
        why={
          resting || restingDays
            ? 'This compares your resting heart rate over the last two weeks with a month before, so it needs about six weeks of it.'
            : undefined
        }>
        {resting ? (
          <>
            <View style={styles.tiles}>
              <Figure label="Last 2 weeks" value={String(resting.recent)} unit="bpm" />
              <Figure label="A month before" value={String(resting.earlier)} unit="bpm" />
            </View>
            {resting.recentSteps !== null && resting.earlierSteps !== null ? (
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
                Steps: {formatSteps(resting.recentSteps)} a day lately, {formatSteps(resting.earlierSteps)} before
              </ThemedText>
            ) : null}
          </>
        ) : restingDays ? (
          <Waiting text={`Needs about six weeks of resting heart rate. ${restingDays} days so far.`} />
        ) : (
          <Waiting
            text="Heart rate comes from a watch or band."
            action={{ label: 'Heart rate', onPress: () => journal('heart') }}
          />
        )}
      </Insight>

      <Insight title="Blood pressure">
        {bpGoal ? (
          <View style={styles.tiles}>
            <Figure
              label="Goal days"
              value={`${bpGoal.goal.systolic}/${bpGoal.goal.diastolic}`}
              note="on average"
             
            />
            <Figure
              label="Other days"
              value={`${bpGoal.other.systolic}/${bpGoal.other.diastolic}`}
              note="on average"
             
            />
          </View>
        ) : (
          <Waiting
            text={`Needs ${MIN_GROUP_DAYS} readings on goal days and ${MIN_GROUP_DAYS} on others. ${data.bp.length} so far.`}
            action={{ label: 'Log a reading', onPress: () => journal('bp') }}
          />
        )}
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Not medical advice. Talk to your doctor about your blood pressure.
        </ThemedText>
      </Insight>

      <Insight title="Recorded walks">
        {data.walks.length ? (
          <>
            <View style={styles.tiles}>
              <Figure label="Walks" value={String(data.walks.length)} note={`last ${WINDOW_DAYS} days`} />
              <Figure
                label="Distance"
                value={formatDistance(
                  data.walks.reduce((s, w) => s + w.distanceM, 0),
                  profile.units,
                )}
                note="in all"
               
              />
            </View>
            {topPlace ? <ThemedText type="bodyMedium">Most start around {topPlace}</ThemedText> : null}
          </>
        ) : (
          <Waiting text="Record a walk from Activity to see where and how far you go." />
        )}
      </Insight>

      <View style={styles.foot}>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.flex}>
          From your last {WINDOW_DAYS} days.
        </ThemedText>
        <Why
          title="Patterns"
          text={`Patterns come from your last ${WINDOW_DAYS} days and show what goes together, not what causes what.`}
        />
      </View>
    </>
  );
}

const lowerFirst = (s: string) => s.replace(/^\w/, (c) => c.toLowerCase());

/** "12% more steps than weekdays", "about the same as weekdays". */
function versus(c: Comparison, others: string): string {
  const change = describeChange(c.change);
  return change === 'about the same' ? `about the same as ${others}` : `${change} steps than ${others}`;
}

/** One insight: its title, a "Why?" when there's more to say, and its numbers. */
function Insight({ title, why, children }: { title: string; why?: string; children: ReactNode }) {
  return (
    <Card title={title} right={why ? <Why title={title} text={why} /> : undefined}>
      {children}
    </Card>
  );
}

/** The headline of an insight: a value in the track numerals, and what it is. */
function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="numeralMedium" maxFontSizeMultiplier={NumeralMaxScale}>
        {value}
      </ThemedText>
      <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * A number inside an insight: what it is, the value in the track numerals,
 * one short note. No plate of its own, since it already sits on the card.
 */
function Figure({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <View style={styles.figureBox} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}${note ? `, ${note}` : ''}`}>
      <ThemedText type="labelMedium" themeColor="onSurfaceVariant" numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.fact}>
        <ThemedText type="numeralMedium" maxFontSizeMultiplier={NumeralMaxScale} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText type="labelMedium" themeColor="onSurfaceVariant">
            {unit}
          </ThemedText>
        ) : null}
      </View>
      {note ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Average steps on two kinds of day, side by side. */
function Pair({ a, b, labelA, labelB }: { a: number; b: number; labelA: string; labelB: string }) {
  return (
    <View style={styles.tiles}>
      <Figure label={labelA} value={formatSteps(a)} note="steps on average" />
      <Figure label={labelB} value={formatSteps(b)} note="steps on average" />
    </View>
  );
}

/** A nutrient against its daily value, or against its limit when `over`. */
function Meter({ label, percent, over }: { label: string; percent: number; over?: boolean }) {
  const theme = useTheme();
  const text = over ? `${percent}% of the limit` : `${percent}% of the daily value`;
  return (
    <View style={styles.meter}>
      <View style={styles.line}>
        {over ? <Ionicons name="alert-circle-outline" size={18} color={theme.error} /> : null}
        <ThemedText type="bodyMedium" style={styles.flex}>
          {label}
        </ThemedText>
        <ThemedText type="labelLarge" style={styles.figure}>
          {percent}%
        </ThemedText>
      </View>
      <TickBar
        value={Math.min(100, percent)}
        max={100}
        tone={over ? 'over' : 'food'}
        height={8}
        accessibilityLabel={`${label}: ${text}`}
      />
    </View>
  );
}

function DayPartBars({ shares }: { shares: Record<string, number> }) {
  const max = Math.max(...Object.values(shares), 0.01);
  return (
    <View style={styles.bars}>
      {DAY_PARTS.map(({ part, label }) => (
        <View key={part} style={styles.barRow}>
          <ThemedText type="labelMedium" style={styles.barLabel}>
            {label}
          </ThemedText>
          <TickBar
            value={shares[part]}
            max={max}
            height={10}
            ticks={false}
            style={styles.barTrack}
            accessibilityLabel={`${label}: ${Math.round(shares[part] * 100)}% of your steps`}
          />
          <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.barValue}>
            {Math.round(shares[part] * 100)}%
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Not enough yet: what it needs, one line, and the action that fills it. */
function Waiting({ text, action }: { text: string; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={styles.waiting}>
      <View style={styles.line}>
        <Ionicons name="hourglass-outline" size={18} color={theme.onSurfaceVariant} />
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.flex}>
          {text}
        </ThemedText>
      </View>
      {action ? <Button variant="tonal" compact label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: Spacing.three },
  figureBox: { flex: 1, minWidth: 0, gap: Spacing.half },
  fact: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: Spacing.two },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  figure: { fontVariant: ['tabular-nums'] },
  meter: { gap: Spacing.one },
  bars: { gap: Spacing.two },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLabel: { width: 76 },
  barTrack: { flex: 1, width: undefined },
  barValue: { width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  waiting: { gap: Spacing.two },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
