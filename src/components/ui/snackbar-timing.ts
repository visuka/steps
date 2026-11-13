/** How long a snackbar stays: long enough to read and reach its action. */
export const SHOW_MS = 6000;
/** With a screen reader and an action, at least this long: reaching Undo takes a few swipes. */
export const SCREEN_READER_MS = 30000;

/**
 * The snackbar's timeout. `recommended` is Android's "Time to take action"
 * value (AccessibilityInfo.getRecommendedTimeoutMillis), null until known.
 * A snackbar with an action honours it, and waits longer with a screen reader on.
 */
export function snackbarTimeout({
  hasAction,
  recommended,
  screenReader,
}: {
  hasAction: boolean;
  recommended: number | null;
  screenReader: boolean;
}): number {
  if (!hasAction) return SHOW_MS;
  const base = Math.max(SHOW_MS, recommended ?? 0);
  return screenReader ? Math.max(base, SCREEN_READER_MS) : base;
}
