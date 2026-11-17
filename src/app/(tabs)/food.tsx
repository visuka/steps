import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { mealWord } from '@/components/food/food-result-format';
import { FoodResultHostView } from '@/components/food/food-result-host';
import { FoodSetupCard } from '@/components/food/food-settings';
import {
  CaloriesTrack,
  GapNoteCard,
  MacrosCard,
  NoteLine,
  NutrientGroupCard,
  WatchCard,
} from '@/components/food/nutrition-view';
import { FoodLog } from '@/components/journal/food-log';
import { Big, Btn, Caps, Label, Mid, Note, plainStyles as ps, Segments, Sub, SyncLine, Tile, Words } from '@/components/plain/plain-kit';
import { PlainPage } from '@/components/plain/plain-page';
import { PLAIN } from '@/components/plain/plain-theme';
import { PremiumCard } from '@/components/premium-gate';
import { SectionHeader, Snackbar } from '@/components/ui';
import { scaled } from '@/constants/ui-scale';
import { dayKey, formatDayLong } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { weekJudgedFor, weekReady, weekWaitText } from '@/nutrition/gaps';
import { TAB_KEY } from '@/nutrition/notes';
import { NUTRIENT } from '@/nutrition/nutrients';
import { dayGlBand, nutrientState } from '@/nutrition/state';
import { energySplit, SPLIT_TEXT, splitVerdict } from '@/nutrition/targets';
import type { NutrientKey } from '@/nutrition/types';
import {
  highWatchChips,
  MACRO_KEYS,
  MINERAL_KEYS,
  type NutrientRowData,
  nutrientRows,
  overDays,
  VITAMIN_KEYS,
  type ViewContext,
  WATCH_KEYS,
} from '@/nutrition/view';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';
import { type NutritionData, useNutrition } from '@/state/use-nutrition';
import { usePremium } from '@/state/use-premium';

const S = scaled;

type Tab = 'day' | 'week';
type Snack = { text: string; action?: { label: string; onPress: () => void } };

const BAND = { low: 'Low', medium: 'Medium', high: 'High' } as const;

const VITAMINS_WHY =
  'Each bar fills towards a day’s need; the dark mark is the usual line. So far means under that line with the day not over yet. After “That’s all for today”, or late at night, it can read Low. Vitamins A, D, E, K and B12 are stored by the body, so the week counts more.';
const MINERALS_WHY =
  'Each bar fills towards a day’s need; the dark mark is the usual line. Calcium, iron, magnesium, phosphorus and selenium are stored by the body, so the week counts more. Potassium and zinc are needed most days.';

/** The meals in the calories tile, in the day's order; "snacks" reads "Snack" as on the mockup. */
const MEALS = [
  { key: 'breakfast', text: 'Breakfast' },
  { key: 'lunch', text: 'Lunch' },
  { key: 'snacks', text: 'Snack' },
  { key: 'dinner', text: 'Dinner' },
] as const;

/**
 * Food, the Nutrition part, in the plain sage-and-sand look (owner, 17 Nov
 * 2026: "I need the app exactly as in the mock.. pixel to pixel"; the mock is
 * plain.html?s=n&k=1&ic=1&icx=1). The top row's switch, "Food · date" with
 * Today / Week, calories in the sage tile with the day's meals, I ate,
 * Eaten today, what today adds up to in the sand tile (tap for every
 * nutrient), That's all for today, and "Values are estimates."
 * `?add=<any new value>` opens the keyboard on the search.
 */
export default function FoodTab() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const premium = usePremium();
  if (premium.isLocked(SCREEN_FEATURES['journal/food'])) {
    return (
      <PlainPage part="nutrition">
        <Sub lead="Food" />
        <PremiumCard />
      </PlainPage>
    );
  }
  return <FoodScreen focusKey={add} />;
}

function FoodScreen({ focusKey }: { focusKey?: string }) {
  const { repo } = useApp();
  const nutrition = useNutrition();
  // Same figure as Today, read again each time the tab comes into view.
  const [visits, setVisits] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisits((n) => n + 1);
    }, []),
  );
  const calories = useCaloriesToday(visits);
  const [tab, setTabState] = useState<Tab>('day');
  const [snack, setSnack] = useState<Snack | null>(null);
  const [lastKey, setLastKey] = useState(focusKey);

  // "Log food" always lands on the day, where the search is.
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

  const onNotForMe = useCallback(
    (id: string, label: string) => {
      nutrition.notForMe(id, true);
      setSnack({ text: `${label} won’t be suggested`, action: { label: 'Undo', onPress: () => nutrition.notForMe(id, false) } });
    },
    [nutrition],
  );

  const today = nutrition.data?.todayKey ?? dayKey(new Date());

  // A food result opens as a screen of its own over the tab, as on the mockups (FoodLog).
  return (
    <FoodResultHostView>
      <PlainPage part="nutrition" overlay={<Snackbar message={snack?.text ?? null} action={snack?.action} onDismiss={() => setSnack(null)} />}>
        <Sub lead="Food" rest={formatDayLong(today)}>
          <Segments<Tab>
            parts={[
              { value: 'day', text: 'TODAY' },
              { value: 'week', text: 'WEEK' },
            ]}
            value={tab}
            onChange={setTab}
            height={32}
            font={10}
            pad={10}
            spoken={(t) => (t === 'day' ? 'Today' : 'This week')}
          />
        </Sub>
        {tab === 'day' ? (
          <DayView data={nutrition.data} calories={calories} focusKey={focusKey} onMark={nutrition.markToday} onDismissNote={nutrition.dismissNote} onNotForMe={onNotForMe} />
        ) : (
          <WeekView data={nutrition.data} onNotForMe={onNotForMe} />
        )}
        <SyncLine text="Values are estimates." bottom={26} />
      </PlainPage>
    </FoodResultHostView>
  );
}

/** Today's calories by meal, from the same entries and values as the list. */
function mealSplit(c: ReturnType<typeof useCaloriesToday>) {
  const kcal: Record<string, number> = {};
  for (const f of c.foods) {
    const meal = mealWord(f.loggedAt);
    kcal[meal] = (kcal[meal] ?? 0) + (c.book.nutrientsOf(f).kcal ?? f.kcal);
  }
  const eaten = MEALS.filter((m) => (kcal[m.key] ?? 0) > 0);
  // Nothing yet: the day's three main meals at 0.
  const shown = eaten.length ? eaten : MEALS.filter((m) => m.key !== 'snacks');
  return shown.map((m) => ({ text: m.text, kcal: Math.round(kcal[m.key] ?? 0) }));
}

/** A small column: a grey name over a figure, "Protein / 42 of 60 g". */
function Cell({ name, value, unit }: { name: string; value: string; unit?: string }) {
  return (
    <View style={ps.col}>
      <Note lines={1} style={styles.cellName}>
        {name}
      </Note>
      <Mid value={value} unit={unit} fit style={styles.cellValue} />
    </View>
  );
}

function CaloriesTile({ eaten, target, atLeast, meals }: { eaten: number; target: number; atLeast: boolean; meals: { text: string; kcal: number }[] }) {
  const router = useRouter();
  const left = target - eaten;
  const pct = target > 0 ? Math.round((eaten / target) * 100) : 0;
  const least = atLeast ? '≥ ' : '';
  return (
    <Tile
      kind="hero"
      style={styles.calories}
      // Today's Food tile used to open this chart; it now opens Food, so the chart opens from here.
      onPress={() => router.push('/detail/food' as unknown as Href)}
      label={`Calories: ${atLeast ? 'at least ' : ''}${formatSteps(eaten)} eaten, ${pct}% of ${formatSteps(target)} kcal, ${left >= 0 ? `${formatSteps(left)} left` : `${formatSteps(-left)} over`}. Opens the calories chart.`}>
      <View style={ps.spread}>
        <Label icon="flame" text="Calories" />
        <Caps text={left >= 0 ? `${formatSteps(left)} left` : `${formatSteps(-left)} over`} />
      </View>
      <View style={[ps.spread, styles.figures]}>
        <Big text={`${least}${formatSteps(eaten)}`} size={64} line={66} />
        <View style={styles.right}>
          <Mid value={`${pct}%`} />
          <Note>of {formatSteps(target)} kcal</Note>
        </View>
      </View>
      <View style={[ps.cols, styles.cols]}>
        {meals.map((m) => (
          <Cell key={m.text} name={m.text} value={formatSteps(m.kcal)} />
        ))}
      </View>
    </Tile>
  );
}

/** A nutrient's figure for the summary: "42" with "of 60 g", or "≥ 42" when some of it isn't known. */
function figure(row: NutrientRowData | undefined, unit: string): { value: string; unit: string } {
  if (!row || row.value === undefined) return { value: '–', unit };
  const of = row.state.target.daily;
  return { value: `${row.partial ? '≥ ' : ''}${formatSteps(row.value)}`, unit: of ? `of ${formatSteps(of)} ${unit}` : unit };
}

/** How many of a group are where they should be: "7 of 13". */
function metCount(rows: NutrientRowData[]): { value: string; unit: string } {
  const met = rows.filter((r) => r.state.state === 'ok' || (r.state.state === 'plain' && (r.state.percent ?? 0) >= 100)).length;
  return { value: String(met), unit: `of ${rows.length}` };
}

function AddsUpTile({
  macros,
  vitamins,
  minerals,
  sugars,
  sodium,
  band,
  open,
  onToggle,
}: {
  macros: NutrientRowData[];
  vitamins: NutrientRowData[];
  minerals: NutrientRowData[];
  sugars: number | undefined;
  sodium: number | undefined;
  band: keyof typeof BAND | null;
  open: boolean;
  onToggle: () => void;
}) {
  const by = (k: NutrientKey) => macros.find((r) => r.key === k);
  const protein = figure(by('protein'), 'g');
  const carbs = figure(by('carbs'), 'g');
  const fat = figure(by('fat'), 'g');
  const vit = metCount(vitamins);
  const min = metCount(minerals);
  // 1 g of salt has about 400 mg of sodium.
  const salt = sodium !== undefined ? `Salt ${Math.round(sodium / 40) / 10} g` : null;
  const gl = band ? `Glycemic load ${BAND[band].toLowerCase()}` : null;
  const foot = [salt, gl].filter(Boolean).join(' · ');
  return (
    <Tile
      kind="second"
      onPress={onToggle}
      label={`What today adds up to: protein ${protein.value} ${protein.unit}, carbs ${carbs.value} ${carbs.unit}, fat ${fat.value} ${fat.unit}, vitamins ${vit.value} ${vit.unit}, minerals ${min.value} ${min.unit}. ${open ? 'Hide' : 'Show'} every nutrient.`}>
      <View style={ps.spread}>
        <Label icon="leaf" text="What today adds up to" />
        <Caps text={open ? 'Hide' : 'All'} />
      </View>
      <View style={[ps.cols, styles.cols]}>
        <Cell name="Protein" {...protein} />
        <Cell name="Carbs" {...carbs} />
        <Cell name="Fat" {...fat} />
      </View>
      <View style={[ps.cols, styles.cols2]}>
        <Cell name="Vitamins" {...vit} />
        <Cell name="Minerals" {...min} />
        <Cell name="Sugar" value={sugars === undefined ? '–' : formatSteps(sugars)} unit="g" />
      </View>
      {foot ? <Note style={styles.foot}>{foot}</Note> : null}
    </Tile>
  );
}

/** "That's all for today" in sage and "Fasting today" beside it; once marked, what it means and Undo. */
function DayDone({ mark, judged, onMark }: { mark: NutritionData['mark']; judged: boolean; onMark: ReturnType<typeof useNutrition>['markToday'] }) {
  if (!mark) {
    return (
      <View style={styles.done}>
        <Btn kind="main" text="That's all for today" onPress={() => onMark('complete')} />
        <Pressable onPress={() => onMark('fasting')} accessibilityRole="button" hitSlop={10}>
          <Words size={13} weight={600} color={PLAIN.muted} line={16}>
            Fasting today
          </Words>
        </Pressable>
      </View>
    );
  }
  return (
    <Tile style={ps.row}>
      <View style={ps.col}>
        <Words size={15} weight={500} line={19}>
          {mark === 'fasting' ? 'Fasting day: not counted' : 'Marked as a full day'}
        </Words>
        {mark === 'complete' && !judged ? <Note>Not much logged, so it won’t count</Note> : null}
      </View>
      <Btn text="Undo" onPress={() => onMark(null)} label="Undo: not marked" />
    </Tile>
  );
}

function DayView({
  data,
  calories,
  focusKey,
  onMark,
  onDismissNote,
  onNotForMe,
}: {
  data: NutritionData | null;
  calories: ReturnType<typeof useCaloriesToday>;
  focusKey?: string;
  onMark: ReturnType<typeof useNutrition>['markToday'];
  onDismissNote: () => void;
  onNotForMe: (id: string, label: string) => void;
}) {
  const { profile, updateProfile } = useApp();
  const [open, setOpen] = useState(false);
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
  const macros = ctx ? nutrientRows(MACRO_KEYS, totals, cov, ctx, judged, 'of', part) : [];
  const vitamins = ctx ? nutrientRows(VITAMIN_KEYS, totals, cov, ctx, judged, 'percent', part) : [];
  const minerals = ctx ? nutrientRows(MINERAL_KEYS, totals, cov, ctx, judged, 'percent', part) : [];

  return (
    <>
      {ctx ? (
        <CaloriesTile eaten={calories.eaten} target={ctx.kcalTarget ?? 2000} atLeast={Boolean(calories.partial.kcal)} meals={mealSplit(calories)} />
      ) : null}
      <FoodLog focusKey={focusKey} />
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
          <AddsUpTile
            macros={macros}
            vitamins={vitamins}
            minerals={minerals}
            sugars={totals.sugars}
            sodium={totals.sodium}
            band={band}
            open={open}
            onToggle={() => setOpen((o) => !o)}
          />
          {open ? (
            <>
              <MacrosCard {...group} rows={macros} split={energySplit(totals, cov)} />
              <NutrientGroupCard {...group} title="Vitamins" why={VITAMINS_WHY} rows={vitamins} weekWords={weekWords} />
              <NutrientGroupCard {...group} title="Minerals" why={MINERALS_WHY} rows={minerals} weekWords={weekWords} />
              <WatchCard
                {...group}
                rows={nutrientRows(WATCH_KEYS, totals, cov, ctx, judged, 'of', part)}
                glLine={band ? `Glycemic load today: ${BAND[band]}` : null}
                chips={data ? highWatchChips(todayEntries, data.window.book) : []}
              />
            </>
          ) : null}
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
  onNotForMe,
}: {
  data: NutritionData | null;
  onNotForMe: (id: string, label: string) => void;
}) {
  // No water on Food (owner, 16 Nov 2026): water's week is on Today's water screen.
  const { profile } = useApp();

  if (!data) return null;
  const { week } = data;
  const ready = weekReady(week.judgedDays);

  if (!ready) {
    return <NoteLine icon="calendar-outline" title={weekWaitText(week.judgedDays) ?? ''} hint={`Full days so far: ${week.judgedDays} of 7`} />;
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

const styles = StyleSheet.create({
  calories: { paddingTop: S(15) },
  figures: { alignItems: 'flex-end', marginTop: S(2) },
  right: { alignItems: 'flex-end', paddingBottom: S(8) },
  cols: { marginTop: S(10) },
  cols2: { marginTop: S(12) },
  cellName: { marginTop: 0 },
  cellValue: { marginTop: S(2) },
  foot: { marginTop: S(10) },
  done: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S(16) },
});
