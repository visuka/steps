import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { type EstimateItem, type EstimateResult, estimateFood, restaurantVersion } from '@/api/food-api';
import { checkDescription, FoodApiError, unknownDishMessage } from '@/api/food-read';
import { Card } from '@/components/card';
import { confirmDelete } from '@/components/confirm';
import { Button, Chip, NumberField, TextField } from '@/components/controls';
import { OwnFoodForm } from '@/components/food/own-food-form';
import { type PlaceInput, PlacePicker } from '@/components/food/place-picker';
import { FoodResult, FoodResultScreen } from '@/components/food/food-result';
import { mealWord } from '@/components/food/food-result-format';
import { useFoodResultLayer, useHasFoodResultHost } from '@/components/food/food-result-host';
import { PortionPicker } from '@/components/food/portion-picker';
import { RecipeForm } from '@/components/food/recipe-form';
import { ThemedText } from '@/components/themed-text';
import { IconButton, Button as UiButton, Why } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { Spacing, TouchTarget } from '@/constants/theme';
import { changeFood, deleteFood, type HealthCopy } from '@/data/entries';
import { type FoodEntry, newId, type RecentFood } from '@/data/types';
import { copyStore } from '@/health/select-source';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, parseDayKey } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { earliestAt, formatClock, formatDay, formatWhenInSentence, timeNow } from '@/lib/when';
import { catalogFood, nutrientsFor, OWN_PREFIX, type PortionOverrides, portionLabel, searchFoods } from '@/nutrition/catalog';
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
import { AT_LEAST, PARTIAL_NOTE } from '@/nutrition/state';
import type { FoodItem, Nutrients } from '@/nutrition/types';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';

const isToday = (ms: number) => dayKey(new Date(ms)) === dayKey(new Date());

/** Home-made unless the person says otherwise; `chosen` is whether they did. */
type PlaceState = PlaceInput & { chosen: boolean };
const HOME_INPUT: PlaceState = { place: 'home', restaurant: '', chosen: false };

type Mode =
  | { kind: 'search' }
  /** `lookup` is the key of the looked-up item this came from, so Add returns to the rest of the meal. */
  | { kind: 'pick'; food: FoodItem; unit?: string; quantity?: number; working?: boolean; lookup?: string }
  | { kind: 'own'; name: string }
  | { kind: 'recipe'; name: string; lookup?: string };

/** An entry opened from the list. `food` is null for calorie-only entries (or a food since deleted). */
interface Editing {
  entry: FoodEntry;
  food: FoodItem | null;
  place: PlaceState;
  at: number;
  name: string;
  kcal: number | null;
}

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

/** `focusKey`: each new value (Today's "Log food") opens the keyboard on the search. */
export function FoodLog({ focusKey }: { focusKey?: string } = {}) {
  const { repo, source, dataVersion, touch } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const clock = useClockStyle();
  const now = useNow();
  const { book, foods: loaded } = useCaloriesToday();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'search' });
  /** When it was eaten; null is "now", whenever Add is tapped. */
  const [eatenAt, setEatenAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  /** What happened to the last change or delete, shown under the list. */
  const [listNote, setListNote] = useState<{ text: string; problem: boolean } | null>(null);
  /** Deleted, so off the list before the next read. */
  const [gone, setGone] = useState<string[]>([]);
  /** The day the list shows; null is today. An earlier day's entries open, change and delete like today's. */
  const [listDay, setListDay] = useState<string | null>(null);
  const [dayFoods, setDayFoods] = useState<{ day: string; foods: FoodEntry[] } | null>(null);
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
  /** A save under way; Delete waits for it, so a slow look-up can't write a copy of an entry already deleted. */
  const [working, setWorking] = useState(false);

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

  useEffect(() => {
    if (!listDay) return;
    let live = true;
    repo
      .getFoods(parseDayKey(listDay).getTime(), parseDayKey(addDaysToKey(listDay, 1)).getTime())
      .then((f) => live && setDayFoods({ day: listDay, foods: f }));
    return () => {
      live = false;
    };
  }, [repo, listDay, dataVersion]);

  const todayKey = dayKey(new Date(now));
  const shownDay = listDay ?? todayKey;
  const showDay = (key: string) => {
    setEditing(null);
    setListNote(null);
    setListDay(key < todayKey ? key : null);
  };

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
    setEatenAt(null);
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
    const at = new Date(eatenAt ?? timeNow());
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
    // Not on today's list, so say where it went.
    if (!isToday(at.getTime())) {
      const added = `Added for ${formatWhenInSentence(at.getTime(), timeNow(), clock)}.`;
      setNotice((n) => (n ? `${n} ${added}` : added));
    }
    touch();
  };

  const once = async (work: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setWorking(true);
    setNotice(null);
    try {
      await work();
    } finally {
      saving.current = false;
      setWorking(false);
    }
  };

  /**
   * The version of a food to log for where it was from (nutrition/place.ts).
   * Eaten out, a home dish becomes its restaurant version: one saved earlier,
   * or one look-up. When that fails the food is logged as it is, and an entry
   * with home values says so.
   */
  const versionFor = async (
    food: FoodItem,
    unit: string,
    quantity: number,
    w: Where,
    say: (text: string) => void = setNotice,
  ) => {
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
      say(
        isHomeDish(food)
          ? 'Couldn’t get restaurant-style values just now, so home-style values were used.'
          : 'Couldn’t look up that restaurant just now, so the restaurant values you had were used.',
      );
      return { food, unit, quantity };
    }
    return { food: next, ...samePortion(food, unit, quantity, next, book.overrides) };
  };

  /** Said before Add or Save: the dish's name leaves the phone without a tap on Look up. */
  const lookupNote = (food: FoodItem, where: Where = here) =>
    needsLookup(food, where, book.find, book.saved)
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

  const startEdit = (entry: FoodEntry, food: FoodItem | null) => {
    setListNote(null);
    setEditing({
      entry,
      food,
      place: { place: entry.place, restaurant: entry.restaurant ?? '', chosen: true },
      at: entry.loggedAt,
      name: entry.name,
      kcal: entry.kcal,
    });
  };
  const changeEditing = (patch: Partial<Editing>) => setEditing((e) => (e ? { ...e, ...patch } : e));
  const editWhere = editing ? whereOf(editing.place.place, editing.place.restaurant) : HOME;

  /** After Save: off the form, with a word when it moved off the day shown or Health Connect couldn't follow. */
  const saved = (at: number, copy: HealthCopy, said: string | null = null) => {
    setEditing(null);
    const parts = [
      said,
      copy === 'failed' ? `Saved here, but couldn't update it in ${copyStore.label}.` : null,
      dayKey(new Date(at)) === shownDay ? null : `Moved to ${formatWhenInSentence(at, timeNow(), clock)}.`,
    ].filter(Boolean);
    setListNote(parts.length ? { text: parts.join(' '), problem: copy === 'failed' } : null);
    touch();
  };

  /** A food: amount, unit, place and time. A new place can mean the other version of the dish (nutrition/place.ts). */
  const saveEdit = (e: Editing, food: FoodItem, unit: string, quantity: number) =>
    once(async () => {
      const w = asksPlace(food) ? editWhere : HOME;
      let said: string | null = null;
      const v = await versionFor(food, unit, quantity, w, (text) => (said = text));
      const n = nutrientsFor(v.food, v.unit, v.quantity, book.overrides);
      const after: FoodEntry = {
        ...e.entry,
        loggedAt: e.at,
        foodId: v.food.id,
        name: v.food === food ? e.entry.name : v.food.name,
        unit: v.unit,
        quantity: v.quantity,
        kcal: Math.round(n.kcal ?? 0),
        place: w.place,
        restaurant: w.restaurant,
      };
      try {
        // The copy is wherever it was saved, even if steps now come from somewhere else.
        saved(after.loggedAt, await changeFood(repo, copyStore, e.entry, after, n), said);
      } catch {
        setListNote({ text: "Couldn't save that change. Please try again.", problem: true });
      }
    });

  /** A calorie-only entry: name, calories, place and time. */
  const saveCalories = (e: Editing) =>
    once(async () => {
      if (e.kcal === null || e.kcal < 0 || !e.name.trim()) return;
      const after: FoodEntry = {
        ...e.entry,
        loggedAt: e.at,
        name: e.name.trim(),
        kcal: Math.round(e.kcal),
        place: editWhere.place,
        restaurant: editWhere.restaurant,
      };
      try {
        saved(after.loggedAt, await changeFood(repo, copyStore, e.entry, after, { kcal: after.kcal }));
      } catch {
        setListNote({ text: "Couldn't save that change. Please try again.", problem: true });
      }
    });

  const remove = async (entry: FoodEntry) => {
    setGone((g) => [...g, entry.id]);
    setEditing((e) => (e?.entry.id === entry.id ? null : e));
    setListNote(null);
    try {
      const copy = await deleteFood(repo, copyStore, entry);
      if (copy === 'failed') {
        setListNote({ text: `Deleted here, but couldn't delete the copy in ${copyStore.label}.`, problem: true });
      }
    } catch {
      setGone((g) => g.filter((id) => id !== entry.id));
      setListNote({ text: "Couldn't delete that entry. Please try again.", problem: true });
    }
    touch();
  };

  const askRemove = (entry: FoodEntry) => confirmDelete('entry', () => remove(entry));

  /** The day picked under "Eaten today". */
  const foods = (listDay === null ? loaded : dayFoods?.day === listDay ? dayFoods.foods : []).filter(
    (f) => !gone.includes(f.id),
  );
  const firstDay = dayKey(new Date(earliestAt(now)));
  const dayName = formatDay(parseDayKey(shownDay).getTime(), now, clock);
  const listTitle = listDay === null ? 'Eaten today' : dayName === 'Yesterday' ? 'Eaten yesterday' : `Eaten on ${dayName}`;

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

  /** The entry's form, in its place on the list: the add form's fields, filled in, with Save and Delete. */
  const editForm = (e: Editing) => {
    const { food } = e;
    const setPlace = (p: PlaceInput) => changeEditing({ place: { ...p, chosen: true } });
    return (
      <View key={e.entry.id} style={[styles.editing, { borderColor: theme.backgroundSelected }]}>
        {food ? (
          <PortionPicker
            food={food}
            overrides={book.overrides}
            initialUnit={e.entry.unit ?? undefined}
            initialQuantity={e.entry.quantity ?? undefined}
            actionLabel="Save"
            busy={busy || working}
            onCancel={() => setEditing(null)}
            onSetPortion={(unit, grams) => book.setPortion(food, unit, grams)}
            onDone={(unit, quantity) => saveEdit(e, food, unit, quantity)}>
            <WhenField value={e.at} onChange={(at) => changeEditing({ at })} />
            {asksPlace(food) ? (
              <PlacePicker value={e.place} onChange={setPlace} restaurants={restaurants} note={lookupNote(food, editWhere)} />
            ) : null}
          </PortionPicker>
        ) : (
          <>
            <ThemedText type="smallBold">Change this entry</ThemedText>
            <TextField label="Name" value={e.name} onChangeText={(name) => changeEditing({ name })} placeholder="What you ate" />
            <NumberField label="Calories" unit="kcal" value={e.kcal} onCommit={(kcal) => changeEditing({ kcal })} placeholder="0" />
            <WhenField value={e.at} onChange={(at) => changeEditing({ at })} />
            <PlacePicker value={e.place} onChange={setPlace} restaurants={restaurants} />
            <Button
              label="Save"
              onPress={() => saveCalories(e)}
              disabled={e.kcal === null || e.kcal < 0 || !e.name.trim() || working}
            />
            <Button kind="secondary" label="Cancel" onPress={() => setEditing(null)} disabled={working} />
          </>
        )}
        {/* Last, after Save and Cancel, as in the other sections; not while a save is under way. */}
        <Button kind="danger" label="Delete this entry" onPress={() => askRemove(e.entry)} disabled={busy || working} />
        {busy ? <Busy /> : null}
      </View>
    );
  };

  // The result is a screen of its own over the Food tab (food-result-host.tsx); a log with no host
  // around it shows it here in the card. The words in their own
  // script are the food's first alias written in another script ("ఎండు చేపల గుడ్డు కూర").
  const covers = useHasFoodResultHost();
  const Result = covers ? FoodResultScreen : FoodResult;
  const pickResult =
    mode.kind === 'pick' ? (
      <Result
        key={mode.food.id}
        query={mode.lookup && lookup.status === 'done' ? lookup.query : null}
        food={mode.food}
        overrides={book.overrides}
        initialUnit={mode.unit}
        initialQuantity={mode.quantity}
        showWorking={mode.working}
        script={scriptOf(mode.food)}
        actionLabel={`Save to ${mealWord(eatenAt ?? now)}`}
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
        <WhenField value={eatenAt ?? now} onChange={setEatenAt} />
        {asksPlace(mode.food) ? (
          <PlacePicker value={placeIn} onChange={choosePlace} restaurants={restaurants} note={lookupNote(mode.food)} />
        ) : null}
      </Result>
    ) : null;
  useFoodResultLayer(covers ? pickResult : null);

  const results = mode.kind === 'search' ? searchFoods(query, book.own, book.saved) : [];
  const q = query.trim();

  return (
    <>
      <Card title="I ate">
        {mode.kind === 'search' ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.entryName}>
                <TextField
                  key={focusKey}
                  autoFocus={focusKey !== undefined}
                  label="Search foods"
                  value={query}
                  onChangeText={changeQuery}
                  placeholder="Search: roti, dal, or “2 idli and sambar”"
                />
              </View>
              {/* Scan a pack's barcode (app/food-scan.tsx); phones only, the web has no scanner. */}
              {Platform.OS === 'web' ? null : (
                <IconButton icon="barcode-outline" variant="tonal" onPress={() => router.push('/food-scan')} accessibilityLabel="Scan a barcode" />
              )}
            </View>
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
              <UiButton
                variant="text"
                compact
                icon="add"
                label={`${results.length ? 'Not here? ' : 'No match. '}Add “${q}” as your own food`}
                onPress={() => go({ kind: 'own', name: q })}
              />
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
            <UiButton
              variant="text"
              compact
              icon="create-outline"
              label="Made it yourself? Enter the recipe"
              onPress={() => go({ kind: 'recipe', name: lookup.status === 'idle' ? q : '' })}
            />
          </>
        ) : null}

        {covers ? null : pickResult}

        {mode.kind === 'own' ? (
          <OwnFoodForm
            initialName={mode.name}
            // Sent only when picked, as with Look up, so the server can read a place from the name.
            where={placeIn.chosen ? here : null}
            overrides={book.overrides}
            onCancel={reset}
            onRecipe={(name) => go({ kind: 'recipe', name })}
            onSave={(own) =>
              once(async () => {
                await book.saveOwn(own);
                await save(OWN_PREFIX + own.id, own.name, 'serving', 1, own.nutrients, here);
                reset();
              })
            }>
            <WhenField value={eatenAt ?? now} onChange={setEatenAt} />
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

        {busy && !editing ? <Busy /> : null}
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

      <Card title={listTitle}>
        <View style={styles.days}>
          <View style={styles.dayButton}>
            <Button
              kind="secondary"
              label="Day before"
              onPress={() => showDay(addDaysToKey(shownDay, -1))}
              disabled={shownDay <= firstDay}
            />
          </View>
          <View style={styles.dayButton}>
            <Button
              kind="secondary"
              label="Next day"
              onPress={() => showDay(addDaysToKey(shownDay, 1))}
              disabled={listDay === null}
            />
          </View>
        </View>
        {foods.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            {listDay === null ? 'Nothing logged today.' : 'Nothing logged that day.'}
          </ThemedText>
        ) : (
          foods.map((f) => {
            if (editing?.entry.id === f.id) return editForm(editing);
            const food = f.foodId ? book.find(f.foodId) : null;
            const kcal = Math.round(book.nutrientsOf(f).kcal ?? f.kcal);
            const detail = [
              food && f.unit && f.quantity !== null ? portionLabel(food, f.unit, f.quantity) : null,
              placeLabel(f),
            ]
              .filter(Boolean)
              .join(' · ');
            const partial = Boolean(food?.missing?.length || food?.pending);
            const note = [valuesNote(f, food), partial ? PARTIAL_NOTE : null].filter(Boolean).join(' · ') || null;
            const least = food?.missing?.includes('kcal') ? AT_LEAST : '';
            const time = formatClock(f.loggedAt, clock);
            return (
              <View key={f.id} style={styles.entry}>
                <Pressable
                  onPress={() => startEdit(f, food)}
                  accessibilityRole="button"
                  accessibilityLabel={`${time}, ${f.name}${detail ? `, ${detail}` : ''}, ${least ? 'at least ' : ''}${kcal} kcal.${note ? ` ${note}.` : ''} Tap to change or delete it.`}
                  style={({ pressed }) => [styles.entryMain, pressed && { opacity: 0.7 }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                    {time}
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
                  <ThemedText style={styles.entryKcal}>
                    {least}
                    {formatSteps(kcal)} kcal
                  </ThemedText>
                </Pressable>
                <IconButton icon="trash-outline" onPress={() => askRemove(f)} accessibilityLabel={`Delete ${f.name}`} />
              </View>
            );
          })
        )}
        {foods.length && !editing ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap an entry to change or delete it
          </ThemedText>
        ) : null}
        {listNote ? (
          <ThemedText type="small" style={listNote.problem ? { color: theme.danger } : undefined} themeColor="textSecondary">
            {listNote.text}
          </ThemedText>
        ) : null}
      </Card>

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
        <View style={styles.hintRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.entryName}>
            For a dish or a whole meal
          </ThemedText>
          <Why
            title="Looking up food"
            text="What you type, your phone’s country and the restaurant if you name one are sent to our server to work out what’s in it. Your name is not sent."
          />
        </View>
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
  const theme = useTheme();
  const where = added
    ? ' · added'
    : food.pending || food.missing?.length
      ? ' · some ingredients not counted yet'
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
      android_ripple={{ color: theme.outlineVariant }}
      style={({ pressed }) => [
        styles.result,
        pressed && { backgroundColor: theme.surfaceContainerHighest },
        added && { opacity: 0.7 },
      ]}>
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
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, 1 ${unit.label}, ${kcal} kcal`}
      android_ripple={{ color: theme.outlineVariant }}
      style={({ pressed }) => [styles.result, pressed && { backgroundColor: theme.surfaceContainerHighest }]}>
      <ThemedText style={styles.entryName}>{food.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        1 {unit.label} · {kcal} kcal
      </ThemedText>
    </Pressable>
  );
}

function Busy() {
  const theme = useTheme();
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={theme.accent} />
      <ThemedText type="small" themeColor="textSecondary">
        Getting restaurant-style values…
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  lookup: { gap: Spacing.two },
  busy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // Material list rows: at least the 48 dp touch target, so a thumb lands on the result it means.
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TouchTarget,
    paddingVertical: Spacing.two,
  },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: TouchTarget },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  time: { width: 64, fontVariant: ['tabular-nums'] },
  entryName: { flex: 1 },
  entryKcal: { fontVariant: ['tabular-nums'] },
  editing: { gap: Spacing.three, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.three },
  days: { flexDirection: 'row', gap: Spacing.two },
  dayButton: { flex: 1 },
});

/** The food's name in its own script (an alias in a non-Latin script), for the result's second line. */
function scriptOf(food: { aliases: string[] }): string | null {
  return food.aliases.find((a) => /[^\s\u0021-\u024F\u1E00-\u1EFF\u2000-\u206F]/.test(a)) ?? null;
}
