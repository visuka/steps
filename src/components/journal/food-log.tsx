import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { type EstimateItem, type EstimateResult, estimateFood, restaurantVersion } from '@/api/food-api';
import { checkDescription, FoodApiError, unknownDishMessage } from '@/api/food-read';
import { Card } from '@/components/card';
import { Button, Chip, Segmented, TextField } from '@/components/controls';
import { NutrientBars } from '@/components/food/nutrient-bars';
import { OwnFoodForm } from '@/components/food/own-food-form';
import { type PlaceInput, PlacePicker } from '@/components/food/place-picker';
import { PortionPicker } from '@/components/food/portion-picker';
import { RecipeForm } from '@/components/food/recipe-form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type FoodEntry, newId, type RecentFood } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';
import { catalogFood, nutrientsFor, OWN_PREFIX, type PortionOverrides, portionLabel, searchFoods } from '@/nutrition/catalog';
import { byStorage, overLimits } from '@/nutrition/day';
import { NUTRIENT } from '@/nutrition/nutrients';
import {
  asksPlace,
  HOME,
  isHomeDish,
  keepSavedNotes,
  markStyle,
  needsLookup,
  placeLabel,
  samePortion,
  savedRestaurantVersion,
  startingPlace,
  valuesNote,
  versionChange,
  type Where,
  whereOf,
} from '@/nutrition/place';
import type { FoodItem, Nutrients } from '@/nutrition/types';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';

/** People often log after eating; minutes ago. */
const WHEN: { value: string; label: string; minutesAgo: number }[] = [
  { value: '0', label: 'Now', minutesAgo: 0 },
  { value: '30', label: '30 min ago', minutesAgo: 30 },
  { value: '60', label: '1 h ago', minutesAgo: 60 },
  { value: '120', label: '2 h ago', minutesAgo: 120 },
];

const eatenAt = (when: string) => new Date(Date.now() - WHEN.find((w) => w.value === when)!.minutesAgo * 60_000);

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const STORAGE = byStorage();

/** Home-made unless the person says otherwise; `chosen` is whether they did. */
type PlaceState = PlaceInput & { chosen: boolean };
const HOME_INPUT: PlaceState = { place: 'home', restaurant: '', chosen: false };

type Mode =
  | { kind: 'search' }
  /** `lookup` is the key of the looked-up item this came from, so Add returns to the rest of the meal. */
  | { kind: 'pick'; food: FoodItem; unit?: string; quantity?: number; working?: boolean; lookup?: string }
  | { kind: 'own'; name: string }
  | { kind: 'recipe'; name: string; lookup?: string }
  | { kind: 'edit'; entry: FoodEntry; food: FoodItem };

type Lookup =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  /** `where`: the place it was worked out for, sent or read from the text. */
  | { status: 'done'; query: string; result: EstimateResult; where: Where | null }
  | { status: 'error'; query: string; message: string };

/**
 * Keys for the parts of a looked-up meal, to tick them off as they're added.
 * By position: the same food can be two parts ("1 roti and 50 g roti").
 */
const itemKey = (index: number) => `item:${index}`;
const unknownKey = (name: string) => `unknown:${name}`;

export function FoodLog() {
  const { repo, source, dataVersion, touch } = useApp();
  const theme = useTheme();
  const { book, foods, nutrients, week, caloriesOnly, eaten, resting, active, burned } = useCaloriesToday();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'search' });
  const [when, setWhen] = useState('0');
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' });
  const [added, setAdded] = useState<string[]>([]);
  const [placeIn, setPlaceIn] = useState<PlaceState>(HOME_INPUT);
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Only the latest lookup's answer is shown; an older one arriving late is dropped.
  const lookupRun = useRef(0);
  // One save at a time: a second tap while the restaurant version is fetched does nothing.
  const saving = useRef(false);

  useEffect(() => {
    let live = true;
    Promise.all([repo.recentFoods(8), repo.recentRestaurants(6)]).then(([r, names]) => {
      if (!live) return;
      setRecent(r);
      setRestaurants(names);
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  const here = whereOf(placeIn.place, placeIn.restaurant);
  const choosePlace = (p: PlaceInput) => setPlaceIn({ ...p, chosen: true });

  const clearLookup = () => {
    lookupRun.current += 1;
    setLookup({ status: 'idle' });
    setAdded([]);
    // A place read from the text belonged to that look-up.
    setPlaceIn((p) => (p.chosen ? p : HOME_INPUT));
  };

  const reset = () => {
    setMode({ kind: 'search' });
    setQuery('');
    setWhen('0');
    setPlaceIn(HOME_INPUT);
    clearLookup();
  };

  /** A new step clears the note about the last save. */
  const go = (next: Mode) => {
    setNotice(null);
    setMode(next);
  };

  /**
   * A food from the list. A saved restaurant version ("Chicken biryani
   * (Paradise)") starts at its own place, unless the person already said
   * they ate out; Cancel resets the chips.
   */
  const pickFood = (food: FoodItem) => {
    go({ kind: 'pick', food });
    const start = placeIn.place === 'home' ? startingPlace(food, recent) : null;
    if (start) setPlaceIn({ place: start.place, restaurant: start.restaurant ?? '', chosen: false });
  };

  const changeQuery = (text: string) => {
    setQuery(text);
    setNotice(null);
    if (lookup.status !== 'idle') clearLookup();
  };

  const save = async (
    foodId: string | null,
    name: string,
    unit: string | null,
    quantity: number | null,
    n: Nutrients,
    w: Where,
  ) => {
    setError(null);
    const at = eatenAt(when);
    let healthSampleId: string | null = null;
    try {
      healthSampleId = (await source.writeFood?.(name, n, at)) ?? null;
    } catch {
      setError(`Saved here, but couldn't copy it to ${source.label}.`);
    }
    await repo.addFood({
      id: newId(),
      loggedAt: at.getTime(),
      name,
      foodId,
      unit,
      quantity,
      kcal: Math.round(n.kcal ?? 0),
      healthSampleId,
      place: w.place,
      restaurant: w.restaurant,
    });
    touch();
  };

  const once = async (work: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setNotice(null);
    try {
      await work();
    } finally {
      saving.current = false;
    }
  };

  /**
   * The version of a food to log for where it was from (nutrition/place.ts).
   * Eaten out, a home dish becomes its restaurant version: one saved earlier,
   * or one look-up. When that fails the food is logged as it is, and an entry
   * with home values says so.
   */
  const versionFor = async (food: FoodItem, unit: string, quantity: number, w: Where) => {
    const change = versionChange(food, w, book.find);
    if (!change) return { food, unit, quantity };
    if (change.kind === 'home') return { food: change.food, ...samePortion(food, unit, quantity, change.food, book.overrides) };
    let next = savedRestaurantVersion(change.base, w, book.saved);
    if (!next) {
      setBusy(true);
      try {
        const item = await restaurantVersion(change.base, w);
        if (item) next = await book.saveFood(markStyle(item.food, 'restaurant', w, change.base.id));
      } catch {
        // Offline, or the day's look-ups used up: logged as it is, below.
      } finally {
        setBusy(false);
      }
    }
    if (!next) {
      setNotice(
        isHomeDish(food)
          ? 'Couldn’t get restaurant-style values just now, so home-style values were used.'
          : 'Couldn’t look up that restaurant just now, so the restaurant values you had were used.',
      );
      return { food, unit, quantity };
    }
    return { food: next, ...samePortion(food, unit, quantity, next, book.overrides) };
  };

  /** Said before Add or Save: the dish's name leaves the phone without a tap on Look up. */
  const lookupNote = (food: FoodItem) =>
    needsLookup(food, here, book.find, book.saved)
      ? 'To get restaurant values, the dish’s name (and the restaurant, if you name one) is sent to our server with your phone’s country, not your name.'
      : null;

  const logFood = async (food: FoodItem, unit: string, quantity: number, w: Where) => {
    const v = await versionFor(food, unit, quantity, w);
    await save(v.food.id, v.food.name, v.unit, v.quantity, nutrientsFor(v.food, v.unit, v.quantity, book.overrides), w);
  };

  /** Back to the looked-up meal with this part ticked off; when every part is in, start fresh. */
  const doneWithPart = (key: string) => {
    const next = [...added, key];
    const parts =
      lookup.status === 'done'
        ? [...lookup.result.items.map((_, i) => itemKey(i)), ...lookup.result.unknown.map(unknownKey)]
        : [];
    if (parts.every((p) => next.includes(p))) {
      reset();
    } else {
      setAdded(next);
      setMode({ kind: 'search' });
    }
  };

  /** The same amount from the same place as last time. */
  const logAgain = (r: RecentFood) =>
    once(async () => {
      const w = whereOf(r.place, r.restaurant);
      const food = r.foodId ? book.find(r.foodId) : null;
      if (food && r.unit && r.quantity !== null) await logFood(food, r.unit, r.quantity, w);
      else await save(null, r.name, null, null, { kcal: r.kcal }, w);
      reset();
    });

  const startEdit = (entry: FoodEntry, food: FoodItem) => {
    go({ kind: 'edit', entry, food });
    setPlaceIn({ place: entry.place, restaurant: entry.restaurant ?? '', chosen: true });
  };

  const remove = async (entry: FoodEntry) => {
    if (entry.healthSampleId) await source.deleteSample?.('food', entry.healthSampleId).catch(() => undefined);
    await repo.deleteFood(entry.id);
    reset();
    touch();
  };

  const lookUp = async () => {
    const text = query.trim();
    const problem = checkDescription(text);
    if (problem) {
      setLookup({ status: 'error', query: text, message: problem });
      return;
    }
    const run = ++lookupRun.current;
    // Sent only when picked, so the server can read a place from the text ("ordered pizza").
    const sent = placeIn.chosen ? here : null;
    setAdded([]);
    setLookup({ status: 'loading', query: text });
    try {
      const result = await estimateFood(text, sent);
      if (run !== lookupRun.current) return;
      setLookup({ status: 'done', query: text, result, where: result.where ?? sent });
      if (!placeIn.chosen && result.where) {
        setPlaceIn({ place: result.where.place, restaurant: result.where.restaurant ?? '', chosen: false });
      }
    } catch (e) {
      if (run !== lookupRun.current) return;
      const message = e instanceof FoodApiError ? e.message : 'Something went wrong. Please try again.';
      setLookup({ status: 'error', query: text, message });
    }
  };

  const pickLooked = async (item: EstimateItem, index: number) => {
    // Built-in foods are used as this app has them; anything else is kept on the phone.
    let food = catalogFood(item.food.id);
    if (!food) {
      try {
        const marked = markStyle(item.food, item.style, lookup.status === 'done' ? lookup.where : null);
        food = await book.saveFood(keepSavedNotes(marked, book.saved));
      } catch {
        setError("Couldn't save it on this phone. Please try again.");
        return;
      }
    }
    const known = food.units.some((u) => u.key === item.unit);
    setMode({
      kind: 'pick',
      food,
      unit: known ? item.unit : undefined,
      quantity: known ? item.quantity : undefined,
      lookup: itemKey(index),
    });
  };

  const results = mode.kind === 'search' ? searchFoods(query, book.own, book.saved) : [];
  const balance = eaten - burned;
  const q = query.trim();
  const over = overLimits(nutrients);

  return (
    <>
      <Card title="Today so far">
        <View style={styles.totals}>
          <Total label="Eaten" value={eaten} />
          <Total label="Burned" value={burned} />
          <Total label={balance > 0 ? 'Over' : 'Under'} value={Math.abs(balance)} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Burned = {formatSteps(resting)} resting (what your body uses anyway) + {formatSteps(active)} from walking.
          Both are estimates; add your birth year in Settings to improve the resting figure.
        </ThemedText>
      </Card>

      <Card title="I ate">
        {mode.kind === 'search' ? (
          <>
            <TextField
              label="Search foods"
              value={query}
              onChangeText={changeQuery}
              placeholder="Search: roti, dal, or “2 idli and sambar”"
            />
            {results.map((food) => (
              <SearchResult key={food.id} food={food} onPress={() => pickFood(food)} />
            ))}

            {q ? (
              <LookupPanel
                query={q}
                lookup={lookup}
                added={added}
                overrides={book.overrides}
                place={placeIn}
                onPlace={choosePlace}
                restaurants={restaurants}
                onLookUp={lookUp}
                onPick={pickLooked}
                onRecipe={(name) => go({ kind: 'recipe', name, lookup: unknownKey(name) })}
              />
            ) : null}

            {q ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.link}
                onPress={() => go({ kind: 'own', name: q })}>
                {results.length ? 'Not here? ' : 'No match. '}Add “{q}” as your own food
              </ThemedText>
            ) : recent.length ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Had it again? Tap to add the same amount
                </ThemedText>
                <View style={styles.chips}>
                  {recent.map((r) => {
                    // Logging again keeps the place, so say it when it isn't home.
                    const out = placeLabel({ place: r.place, restaurant: null });
                    return (
                      <Chip key={r.foodId ?? r.name} label={out ? `${r.name} · ${out}` : r.name} onPress={() => logAgain(r)} />
                    );
                  })}
                </View>
              </>
            ) : null}
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.link}
              onPress={() => go({ kind: 'recipe', name: lookup.status === 'idle' ? q : '' })}>
              Made it yourself? Enter the recipe
            </ThemedText>
          </>
        ) : null}

        {mode.kind === 'pick' ? (
          <PortionPicker
            key={mode.food.id}
            food={mode.food}
            overrides={book.overrides}
            initialUnit={mode.unit}
            initialQuantity={mode.quantity}
            showWorking={mode.working}
            actionLabel="Add"
            busy={busy}
            onCancel={() => (mode.lookup ? setMode({ kind: 'search' }) : reset())}
            onSetPortion={(unit, grams) => book.setPortion(mode.food, unit, grams)}
            onDone={(unit, quantity) =>
              once(async () => {
                const part = mode.lookup;
                await logFood(mode.food, unit, quantity, asksPlace(mode.food) ? here : HOME);
                if (part) doneWithPart(part);
                else reset();
              })
            }>
            <Segmented options={WHEN} value={when} onChange={setWhen} />
            {asksPlace(mode.food) ? (
              <PlacePicker value={placeIn} onChange={choosePlace} restaurants={restaurants} note={lookupNote(mode.food)} />
            ) : null}
          </PortionPicker>
        ) : null}

        {mode.kind === 'edit' ? (
          <PortionPicker
            key={mode.entry.id}
            food={mode.food}
            overrides={book.overrides}
            initialUnit={mode.entry.unit ?? undefined}
            initialQuantity={mode.entry.quantity ?? undefined}
            actionLabel="Save"
            busy={busy}
            onCancel={reset}
            onSetPortion={(unit, grams) => book.setPortion(mode.food, unit, grams)}
            onDone={(unit, quantity) =>
              once(async () => {
                const w = asksPlace(mode.food) ? here : HOME;
                // A new place can mean the other version of the dish (nutrition/place.ts).
                const v = await versionFor(mode.food, unit, quantity, w);
                const n = nutrientsFor(v.food, v.unit, v.quantity, book.overrides);
                await repo.updateFood({
                  ...mode.entry,
                  foodId: v.food.id,
                  name: v.food === mode.food ? mode.entry.name : v.food.name,
                  unit: v.unit,
                  quantity: v.quantity,
                  kcal: Math.round(n.kcal ?? 0),
                  place: w.place,
                  restaurant: w.restaurant,
                });
                reset();
                touch();
              })
            }>
            {asksPlace(mode.food) ? (
              <PlacePicker value={placeIn} onChange={choosePlace} restaurants={restaurants} note={lookupNote(mode.food)} />
            ) : null}
            <Button kind="danger" label="Delete this entry" onPress={() => remove(mode.entry)} />
          </PortionPicker>
        ) : null}

        {mode.kind === 'own' ? (
          <OwnFoodForm
            initialName={mode.name}
            onCancel={reset}
            onSave={(own) =>
              once(async () => {
                await book.saveOwn(own);
                await save(OWN_PREFIX + own.id, own.name, 'serving', 1, own.nutrients, here);
                reset();
              })
            }>
            <PlacePicker value={placeIn} onChange={choosePlace} restaurants={restaurants} />
          </OwnFoodForm>
        ) : null}

        {mode.kind === 'recipe' ? (
          <RecipeForm
            initialName={mode.name}
            onCancel={() => (mode.lookup ? setMode({ kind: 'search' }) : reset())}
            onDone={async (result) => {
              const food = await book.saveFood(result.food);
              setMode({
                kind: 'pick',
                food,
                unit: food.defaultUnit,
                quantity: 1,
                working: true,
                lookup: mode.lookup,
              });
            }}
          />
        ) : null}

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary">
              Getting restaurant-style values…
            </ThemedText>
          </View>
        ) : null}
        {notice ? (
          <ThemedText type="small" themeColor="textSecondary">
            {notice}
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Eaten today">
        {foods.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing logged today.</ThemedText>
        ) : (
          foods.map((f) => {
            const food = f.foodId ? book.find(f.foodId) : null;
            const kcal = Math.round(book.nutrientsOf(f).kcal ?? f.kcal);
            const detail = [
              food && f.unit && f.quantity !== null ? portionLabel(food, f.unit, f.quantity) : null,
              placeLabel(f),
            ]
              .filter(Boolean)
              .join(' · ');
            const note = valuesNote(f, food);
            return (
              <Pressable
                key={f.id}
                onPress={() => (food ? startEdit(f, food) : undefined)}
                accessibilityRole="button"
                accessibilityLabel={`${f.name}${detail ? `, ${detail}` : ''}, ${kcal} kcal.${note ? ` ${note}.` : ''} ${food ? 'Change amount or place' : ''}`}
                style={styles.entry}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                  {timeOf(f.loggedAt)}
                </ThemedText>
                <View style={styles.entryName}>
                  <ThemedText>{f.name}</ThemedText>
                  {detail ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {detail}
                    </ThemedText>
                  ) : null}
                  {note ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {note}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.entryKcal}>{formatSteps(kcal)} kcal</ThemedText>
                {food ? null : (
                  <Pressable onPress={() => remove(f)} accessibilityRole="button" accessibilityLabel={`Delete ${f.name}`} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                )}
              </Pressable>
            );
          })
        )}
        {foods.some((f) => f.foodId) ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap an entry to change the amount or where it was from, or to delete it.
          </ThemedText>
        ) : null}
      </Card>

      {foods.length ? (
        <Card title="Nutrients today">
          <NutrientBars title="Calories and macros" nutrients={nutrients} groups={['energy', 'macro']} />
          {over.length ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Over the advised limit today: {over.map((o) => NUTRIENT[o.key].label.toLowerCase()).join(', ')}.
            </ThemedText>
          ) : null}
          <NutrientBars title="Keep low" nutrients={nutrients} groups={['limit']} />
          <NutrientBars title="Sugar and glucose" nutrients={nutrients} groups={['glucose']} glScale="day" />
          <NutrientBars
            title="Needed every day (your body keeps little)"
            nutrients={nutrients}
            keys={STORAGE.daily.map((n) => n.key)}
          />
          <NutrientBars
            title="Stored by your body (the week's average counts)"
            nutrients={nutrients}
            keys={STORAGE.stored.map((n) => n.key)}
            average={week.average}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Estimates. Targets are general adult daily values (US FDA); limits follow WHO advice. Your own needs may
            differ. Week figures average the {week.days} {week.days === 1 ? 'day' : 'days'} you logged food in the last 7
            {caloriesOnly ? `; ${caloriesOnly} calorie-only ${caloriesOnly === 1 ? 'entry adds' : 'entries add'} no nutrients` : ''}.
            Tap a row to see what it is.
          </ThemedText>
        </Card>
      ) : null}
    </>
  );
}

/** "Look up" for text the list doesn't have, and what came back. */
function LookupPanel({
  query,
  lookup,
  added,
  overrides,
  place,
  onPlace,
  restaurants,
  onLookUp,
  onPick,
  onRecipe,
}: {
  query: string;
  lookup: Lookup;
  added: string[];
  overrides: PortionOverrides;
  place: PlaceInput;
  onPlace: (p: PlaceInput) => void;
  restaurants: string[];
  onLookUp: () => void;
  onPick: (item: EstimateItem, index: number) => void;
  onRecipe: (name: string) => void;
}) {
  const theme = useTheme();

  if (lookup.status === 'loading') {
    return (
      <View style={styles.busy}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">
          Looking up “{lookup.query}”…
        </ThemedText>
      </View>
    );
  }

  if (lookup.status === 'done') {
    const { items, unknown } = lookup.result;
    // Only when the server did work them out that way; one from before places ignores the place.
    const out = lookup.where && items.some((i) => i.style === 'restaurant') ? placeLabel(lookup.where) : null;
    return (
      <View style={styles.lookup}>
        {out && items.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            {out}: restaurant-style values
          </ThemedText>
        ) : null}
        {items.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            {items.length > 1 ? 'Tap each one to add it' : 'Tap to add it'}
          </ThemedText>
        ) : null}
        {items.map((item, index) => (
          <LookedUpRow
            key={itemKey(index)}
            item={item}
            overrides={overrides}
            added={added.includes(itemKey(index))}
            onPress={() => onPick(item, index)}
          />
        ))}
        {unknown.map((name) =>
          added.includes(unknownKey(name)) ? (
            <ThemedText key={name} type="small" themeColor="textSecondary">
              {name}: added
            </ThemedText>
          ) : (
            <View key={name} style={styles.lookup}>
              <ThemedText type="small" themeColor="textSecondary">
                {unknownDishMessage(name)}
              </ThemedText>
              <Button kind="secondary" label="Tell us how it’s made" onPress={() => onRecipe(name)} />
            </View>
          ),
        )}
        {!items.length && !unknown.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing found. Try naming the dish and how much, like “1 bowl dal”.
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.lookup}>
      {lookup.status === 'error' ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {lookup.message}
        </ThemedText>
      ) : null}
      <PlacePicker value={place} onChange={onPlace} restaurants={restaurants} />
      <Button kind="secondary" label={`Look up “${query}”`} onPress={onLookUp} />
      {lookup.status === 'idle' ? (
        <ThemedText type="small" themeColor="textSecondary">
          For a dish or a whole meal. What you type, your phone’s country and the restaurant if you name one are sent
          to our server, not your name.
        </ThemedText>
      ) : null}
    </View>
  );
}

function LookedUpRow({
  item,
  overrides,
  added,
  onPress,
}: {
  item: EstimateItem;
  overrides: PortionOverrides;
  added: boolean;
  onPress: () => void;
}) {
  const food = catalogFood(item.food.id) ?? item.food;
  const unit = food.units.some((u) => u.key === item.unit) ? item.unit : food.defaultUnit;
  const quantity = unit === item.unit ? item.quantity : 1;
  const kcal = Math.round(nutrientsFor(food, unit, quantity, overrides).kcal ?? 0);
  const where = added
    ? ' · added'
    : catalogFood(item.food.id)
      ? ' · from our food list'
      : item.cached
        ? ' · saved earlier'
        : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${portionLabel(food, unit, quantity)}, ${kcal} kcal${where}`}
      style={({ pressed }) => [styles.result, { opacity: pressed ? 0.6 : added ? 0.7 : 1 }]}>
      <View style={styles.entryName}>
        <ThemedText>{food.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {portionLabel(food, unit, quantity)}
          {where}
        </ThemedText>
      </View>
      <ThemedText style={styles.entryKcal}>{formatSteps(kcal)} kcal</ThemedText>
    </Pressable>
  );
}

function SearchResult({ food, onPress }: { food: FoodItem; onPress: () => void }) {
  const unit = food.units.find((u) => u.key === food.defaultUnit) ?? food.units[0];
  const kcal = Math.round(((food.per100g.kcal ?? 0) * unit.grams) / 100);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.result, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText style={styles.entryName}>{food.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        1 {unit.label} · {kcal} kcal
      </ThemedText>
    </Pressable>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.totalValue}>{formatSteps(value)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        kcal
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { flex: 1, alignItems: 'center', gap: Spacing.half },
  totalValue: { fontSize: 24, lineHeight: 30, fontWeight: 700, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  link: { textDecorationLine: 'underline' },
  lookup: { gap: Spacing.two },
  busy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  time: { width: 64, fontVariant: ['tabular-nums'] },
  entryName: { flex: 1 },
  entryKcal: { fontVariant: ['tabular-nums'] },
});
