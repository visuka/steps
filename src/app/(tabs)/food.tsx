import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { Segmented } from '@/components/controls';
import { FoodSetupCard } from '@/components/food/food-settings';
import {
  CaloriesTrack,
  DayDone,
  GapNoteCard,
  MacrosCard,
  NoteLine,
  NutrientGroupCard,
  WatchCard,
} from '@/components/food/nutrition-view';
import { WaterCard } from '@/components/food/water-card';
import { FoodLog } from '@/components/journal/food-log';
import { PremiumGate } from '@/components/premium-gate';
import { Screen, SectionHeader, Snackbar } from '@/components/ui';
import type { LogEntry } from '@/data/types';
import { dayKey } from '@/lib/dates';
import { weekJudgedFor, weekReady, weekWaitText } from '@/nutrition/gaps';
import { TAB_KEY } from '@/nutrition/notes';
import { NUTRIENT } from '@/nutrition/nutrients';
import { dayGlBand, nutrientState } from '@/nutrition/state';
import { energySplit, needsAreDifferent, SPLIT_TEXT, splitVerdict } from '@/nutrition/targets';
import type { NutrientKey } from '@/nutrition/types';
import { highWatchChips, MACRO_KEYS, MINERAL_KEYS, nutrientRows, overDays, VITAMIN_KEYS, type ViewContext, WATCH_KEYS } from '@/nutrition/view';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { type NutritionData, useNutrition } from '@/state/use-nutrition';
import { usePremium } from '@/state/use-premium';
import { type AddedGlass, useWaterToday } from '@/state/use-water';
import { waterWeek } from '@/water/today';

type Tab = 'day' | 'week';
type Snack = { text: string; action?: { label: string; onPress: () => void } };

const BAND = { low: 'Low', medium: 'Medium', high: 'High' } as const;

const VITAMINS_WHY =
  'Each bar fills towards a day’s need; the dark mark is the usual line. So far means under that line with the day not over yet. After “That’s all for today”, or late at night, it can read Low. Vitamins A, D, E, K and B12 are stored by the body, so the week counts more.';
const MINERALS_WHY =
  'Each bar fills towards a day’s need; the dark mark is the usual line. Calcium, iron, magnesium, phosphorus and selenium are stored by the body, so the week counts more. Potassium and zinc are needed most days.';

/**
 * Food, a top-level tab: the day's energy on a red-oxide track, the food log,
 * water, and what the food adds up to, for the day or the week of full days.
 * `?add=<any new value>` (Today's "Log food") opens the keyboard on the search.
 */
export default function FoodTab() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  return (
    <PremiumGate feature={SCREEN_FEATURES['journal/food']} title="Food">
      <FoodScreen focusKey={add} />
    </PremiumGate>
  );
}

function FoodScreen({ focusKey }: { focusKey?: string }) {
  const { repo } = useApp();
  const premium = usePremium();
  const waterOn = !premium.isLocked('body');
  const water = useWaterToday(waterOn);
  const nutrition = useNutrition();
  const [tab, setTabState] = useState<Tab>('day');
  const [snack, setSnack] = useState<Snack | null>(null);
  const [lastKey, setLastKey] = useState(focusKey);

  // "Log food" from Today always lands on the day, where the search is.
  if (focusKey !== lastKey) {
    setLastKey(focusKey);
    if (tab !== 'day') setTabState('day');
  }

  useEffect(() => {
    let live = true;
    repo.getKv<Tab>(TAB_KEY).then((t) => live && focusKey === undefined && (t === 'day' || t === 'week') && setTabState(t));
    return () => {
      live = false;
    };
    // Read once: a later Log food keeps the day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const setTab = (t: Tab) => {
    setTabState(t);
    repo.setKv(TAB_KEY, t).catch(() => undefined);
  };

  const onAdded = useCallback(
    (a: AddedGlass | null) => {
      if (!a) {
        setSnack({ text: 'Couldn’t save that. Try again.' });
        return;
      }
      const entry: LogEntry = a.entry;
      setSnack({ text: a.text, action: { label: 'Undo', onPress: () => water.undo(entry) } });
    },
    [water],
  );

  const onNotForMe = useCallback(
    (id: string, label: string) => {
      nutrition.notForMe(id, true);
      setSnack({ text: `${label} won’t be suggested`, action: { label: 'Undo', onPress: () => nutrition.notForMe(id, false) } });
    },
    [nutrition],
  );

  return (
    <Screen
      title="Food"
      overlay={<Snackbar message={snack?.text ?? null} action={snack?.action} onDismiss={() => setSnack(null)} />}>
      <Segmented<Tab>
        options={[
          { value: 'day', label: 'Today' },
          { value: 'week', label: 'This week' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'day' ? (
        <DayView
          data={nutrition.data}
          focusKey={focusKey}
          water={waterOn ? <WaterCard water={water} onAdded={onAdded} /> : null}
          onMark={nutrition.markToday}
          onDismissNote={nutrition.dismissNote}
          onNotForMe={onNotForMe}
        />
      ) : (
        <WeekView data={nutrition.data} waterOn={waterOn} onNotForMe={onNotForMe} />
      )}
    </Screen>
  );
}

function DayView({
  data,
  focusKey,
  water,
  onMark,
  onDismissNote,
  onNotForMe,
}: {
  data: NutritionData | null;
  focusKey?: string;
  water: ReactNode;
  onMark: ReturnType<typeof useNutrition>['markToday'];
  onDismissNote: () => void;
  onNotForMe: (id: string, label: string) => void;
}) {
  const { profile, updateProfile } = useApp();
  const diet = profile.nutrition.diet;
  const t = data?.today ?? null;
  const totals = t?.total ?? {};
  const cov = t?.coverage ?? {};
  const part = t?.partial ?? {};
  const ctx = data?.ctx;
  const judged = data?.judgedToday ?? false;
  const plain = ctx?.plain ?? false;
  const group = {
    diet,
    sourceOpts: data?.sources ?? {},
    plain,
    onNotForMe,
  };
  const weekWords = data && ctx ? storedWeekWords(data, ctx) : undefined;
  const todayEntries = data ? data.window.entries.filter((e) => dayKey(new Date(e.loggedAt)) === data.todayKey) : [];
  const band = dayGlBand(totals.gl, judged);
  const note = data?.note?.note && !data.note.dismissed && !plain ? data.note.note : null;

  return (
    <>
      {ctx ? <CaloriesTrack eaten={Math.round(totals.kcal ?? 0)} target={ctx.kcalTarget ?? 2000} atLeast={Boolean(part.kcal)} /> : null}
      <FoodLog focusKey={focusKey} />
      {water}
      <FoodSetupCard />
      {note ? (
        <GapNoteCard
          note={note}
          diet={diet}
          sourceOpts={data?.sources ?? {}}
          onDismiss={onDismissNote}
          onDiet={(d) => updateProfile({ nutrition: { diet: d } })}
          onNotForMe={onNotForMe}
        />
      ) : null}
      {t && ctx ? (
        <>
          <SectionHeader title="What today adds up to" />
          <MacrosCard {...group} rows={nutrientRows(MACRO_KEYS, totals, cov, ctx, judged, 'of', part)} split={energySplit(totals, cov)} />
          <NutrientGroupCard
            {...group}
            title="Vitamins"
            why={VITAMINS_WHY}
            rows={nutrientRows(VITAMIN_KEYS, totals, cov, ctx, judged, 'percent', part)}
            weekWords={weekWords}
          />
          <NutrientGroupCard
            {...group}
            title="Minerals"
            why={MINERALS_WHY}
            rows={nutrientRows(MINERAL_KEYS, totals, cov, ctx, judged, 'percent', part)}
            weekWords={weekWords}
          />
          <WatchCard
            {...group}
            rows={nutrientRows(WATCH_KEYS, totals, cov, ctx, judged, 'of', part)}
            glLine={band ? `Glycemic load today: ${BAND[band]}` : null}
            chips={data ? highWatchChips(todayEntries, data.window.book) : []}
          />
        </>
      ) : null}
      {data ? <DayDone mark={data.mark} judged={judged} onMark={onMark} /> : null}
    </>
  );
}

/** On the Day tab, a stored nutrient also says how the week stands: that's what counts for it. */
function storedWeekWords(data: NutritionData, ctx: ViewContext): Partial<Record<NutrientKey, string>> | undefined {
  if (ctx.plain || !weekReady(data.week.judgedDays)) return undefined;
  const out: Partial<Record<NutrientKey, string>> = {};
  for (const key of [...VITAMIN_KEYS, ...MINERAL_KEYS]) {
    if (NUTRIENT[key].storage !== 'stored') continue;
    const s = nutrientState(key, data.week.average[key], {
      ...ctx,
      coverage: data.week.coverage[key] ?? 0,
      judged: weekJudgedFor(data.week, key),
      partial: Boolean(data.week.partial[key]),
    });
    if (s.word) out[key] = s.word.toLowerCase();
  }
  return out;
}

function WeekView({
  data,
  waterOn,
  onNotForMe,
}: {
  data: NutritionData | null;
  waterOn: boolean;
  onNotForMe: (id: string, label: string) => void;
}) {
  const { repo, profile, dataVersion } = useApp();
  const [waterMet, setWaterMet] = useState<number | null>(null);
  // Same gate as the Sunday summary: only against a target the person saved.
  const waterShown =
    waterOn && profile.water.targetMl !== null && !profile.water.doctorLimit && !needsAreDifferent(profile, new Date().getFullYear());

  useEffect(() => {
    if (!waterShown) return;
    let live = true;
    waterWeek(repo, profile)
      .then((w) => live && setWaterMet(w.metDays))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [repo, profile, dataVersion, waterShown]);

  if (!data) return null;
  const { week } = data;
  const ready = weekReady(week.judgedDays);
  const waterLine = !waterShown || waterMet === null ? null : `Water target met on ${waterMet} of 7 days`;

  if (!ready) {
    return (
      <>
        <NoteLine icon="calendar-outline" title={weekWaitText(week.judgedDays) ?? ''} hint={`Full days so far: ${week.judgedDays} of 7`} />
        {waterLine ? <NoteLine icon="water-outline" title={waterLine} /> : null}
      </>
    );
  }

  const ctx: ViewContext = { ...data.ctx, kcalTarget: data.fullKcal };
  const avg = week.average;
  const cov = week.coverage;
  const part = week.partial;
  const group = { diet: profile.nutrition.diet, sourceOpts: data.sources, plain: ctx.plain, onNotForMe };
  const judgedFor = (key: NutrientKey) => weekJudgedFor(week, key);
  const split = energySplit(avg, cov);
  const over: Partial<Record<NutrientKey, string>> = {};
  for (const key of WATCH_KEYS) {
    const n = overDays(data.weekDays, key);
    if (n) over[key] = `over on ${n} of 7 days`;
  }

  return (
    <>
      <SectionHeader
        title={`Average of ${week.judgedDays} full days`}
        why="A full day has most of the day’s food logged, or was marked “That’s all for today”. Fasting days and light days are left out, so they don’t pull the average down."
      />
      <CaloriesTrack eaten={Math.round(avg.kcal ?? 0)} target={data.fullKcal} label="a day, of about" atLeast={Boolean(part.kcal)} />
      {waterLine ? <NoteLine icon="water-outline" title={waterLine} /> : null}
      <MacrosCard
        {...group}
        rows={nutrientRows(MACRO_KEYS, avg, cov, ctx, judgedFor, 'of', part)}
        split={split}
        splitLine={split && !ctx.plain ? SPLIT_TEXT[splitVerdict(split)] : null}
      />
      <NutrientGroupCard {...group} title="Vitamins" why={VITAMINS_WHY} rows={nutrientRows(VITAMIN_KEYS, avg, cov, ctx, judgedFor, 'percent', part)} />
      <NutrientGroupCard {...group} title="Minerals" why={MINERALS_WHY} rows={nutrientRows(MINERAL_KEYS, avg, cov, ctx, judgedFor, 'percent', part)} />
      <WatchCard {...group} rows={nutrientRows(WATCH_KEYS, avg, cov, ctx, judgedFor, 'of', part)} extra={over} />
    </>
  );
}
