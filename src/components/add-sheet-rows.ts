import type { SpecIconName } from '@/components/ui/icons';

/** The key and label of the middle plus on the bar: it opens the Add sheet, it is not a route. */
export const ADD_KEY = 'add';
export const ADD_LABEL = 'Add';

/** The Journal parts the sheet can open (the same names app/(tabs)/journal.tsx reads from `section`). */
export type AddJournalPart = 'sleep' | 'mood' | 'weight' | 'bp' | 'water';

export type AddRowKey = AddJournalPart | 'walk';

export interface AddRow {
  key: AddRowKey;
  label: string;
  icon: SpecIconName;
  /** Spoken by TalkBack as the row's name. */
  accessibilityLabel: string;
}

/** The sheet's rows, in order. Food is not here: it has its own tab. */
export const ADD_ROWS: readonly AddRow[] = [
  { key: 'sleep', label: 'Sleep', icon: 'moon', accessibilityLabel: 'Add sleep' },
  { key: 'mood', label: 'Mood', icon: 'sun', accessibilityLabel: 'Add mood' },
  { key: 'weight', label: 'Weight', icon: 'gauge', accessibilityLabel: 'Add weight' },
  { key: 'bp', label: 'Blood pressure', icon: 'pulse', accessibilityLabel: 'Add blood pressure' },
  { key: 'water', label: 'Water', icon: 'drop', accessibilityLabel: 'Add water' },
  { key: 'walk', label: 'Start walk', icon: 'walker', accessibilityLabel: 'Start a walk' },
];

export type AddTarget =
  | { pathname: '/journal'; params: { section: AddJournalPart; n: string } }
  | { pathname: '/walk/record' };

/**
 * Where a row goes. Journal rows name the part in `section` and carry a fresh
 * `n`, so the Journal switches to the part even if it is already open on another
 * one (its entry form is on the part's page). Start walk is the walk start.
 */
export function addTarget(key: AddRowKey, now: number): AddTarget {
  if (key === 'walk') return { pathname: '/walk/record' };
  return { pathname: '/journal', params: { section: key, n: String(now) } };
}

/** A value that differs on each press (a time in ms). */
export const freshNonce = (): number => Date.now();
