import { useEffect, useRef, useState } from 'react';

import type { CookedDish, CookingTables } from '@/nutrition/cooking/types';
import type { FoodItem } from '@/nutrition/types';

import {
  type EditRow,
  editProblem,
  editRowsFrom,
  liveDish,
  LOOKING_UP,
  lookUpAddedRows,
  type OpenWithProfiles,
  openRows,
  opensWithLookUp,
  type ProfileFetch,
} from './food-result-edit';

/** What editing the ingredients needs for the phone's own maths (plan T15c); without it editing is the recipe look-up way. */
export interface RecipeCooking {
  /** The factor tables kept on the phone, or null while there are none. */
  tables: CookingTables | null;
  country: string;
  /** POST /v1/food/ingredients, for the rows the person adds (state/use-food-book.ts). */
  fetchProfiles: ProfileFetch;
  /** The food's ingredients with profiles, for opening Edit recipe; null = go the recipe look-up way. */
  withProfiles: OpenWithProfiles;
}

export interface RecipeEdit {
  /** The ingredient list while it is edited; null when it is not. */
  rows: EditRow[] | null;
  setRows: (change: (rows: EditRow[]) => EditRow[]) => void;
  /** Opening waits for the profiles the food lacks. */
  opening: boolean;
  /** The dish worked out from the rows (no network), or null when the recipe look-up has to do it. */
  dish: CookedDish | null;
  /** Why Use these ingredients is off, or null. */
  problem: string | null;
  start: () => void;
  stop: () => void;
  /** The name of an added row was entered: look its profile up (one call at a time). */
  lookUp: () => Promise<void>;
  /** The message of the last confirm that did not keep the version. */
  message: string | null;
  setMessage: (message: string | null) => void;
}

/**
 * The edit session of "Edit recipe" (plan T15c): the rows, the opening look-up, the
 * look-ups of added rows and the live dish. The result view only reads it.
 */
export function useRecipeEdit(food: FoodItem, cooking: RecipeCooking | undefined, startEditing: boolean): RecipeEdit {
  const [rows, setRowsState] = useState<EditRow[] | null>(() => (startEditing ? editRowsFrom(food.ingredients ?? []) : null));
  const rowsNow = useRef(rows);
  useEffect(() => {
    rowsNow.current = rows;
  });
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const openRun = useRef(0);
  const looking = useRef(false);

  const setRows = (change: (r: EditRow[]) => EditRow[]) => setRowsState((r) => (r ? change(r) : r));
  // The numbers follow the rows while they are edited, with no network (decision 8).
  const dish =
    rows && cooking?.tables ? liveDish(rows, { tables: cooking.tables, dishName: food.name, country: cooking.country, panOil: food.panOil }) : null;

  const start = () => {
    setMessage(null);
    setRowsState(editRowsFrom(food.ingredients ?? []));
    const hasTables = !!cooking?.tables;
    if (!opensWithLookUp(food, cooking?.withProfiles, hasTables)) return;
    const run = ++openRun.current;
    setOpening(true);
    openRows(food, cooking?.withProfiles, hasTables).then((opened) => {
      if (run !== openRun.current) return;
      setOpening(false);
      setRowsState((r) => (r ? opened : r));
    });
  };
  const stop = () => {
    openRun.current += 1;
    setOpening(false);
    setRowsState(null);
  };
  const lookUp = async () => {
    if (!cooking || looking.current) return;
    looking.current = true;
    try {
      await lookUpAddedRows(() => rowsNow.current, setRows, cooking.fetchProfiles, food.name);
    } finally {
      looking.current = false;
    }
  };
  const problem = rows ? (opening ? LOOKING_UP : editProblem(rows)) : null;
  return { rows, setRows, opening, dish, problem, start, stop, lookUp, message, setMessage };
}
