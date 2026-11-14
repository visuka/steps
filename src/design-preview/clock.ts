/**
 * The design preview's clock: in a preview run (design-preview/launch.ts)
 * `new Date()` and `Date.now()` read as the sample day (Sat 14 Nov 2026, 3:45 pm
 * local) and keep ticking from there, so every screen's "today", "7:10 am"
 * and "Sat, 14 Nov" match the mockups without each screen taking a clock.
 *
 * Installed once, at start-up, only in a run started by the preview's link,
 * where nothing reads or writes the phone's data. Dates made from a given
 * time (`new Date(ms)`, `new Date(y, m, d)`) are untouched.
 */

let installed = false;

/** Shifts the JavaScript clock so it reads `targetMs` now. Returns the shift, ms. */
export function installPreviewClock(targetMs: number): number {
  const RealDate = Date;
  const offset = targetMs - RealDate.now();
  if (installed) return offset;
  installed = true;

  function PreviewDate(this: unknown, ...args: unknown[]): Date | string {
    const now = new RealDate(RealDate.now() + offset);
    // Called without `new`, Date() gives the time as text.
    if (!(this instanceof PreviewDate)) return now.toString();
    return args.length === 0 ? now : new (RealDate as unknown as new (...a: unknown[]) => Date)(...args);
  }
  PreviewDate.prototype = RealDate.prototype;
  PreviewDate.now = () => RealDate.now() + offset;
  PreviewDate.parse = RealDate.parse;
  PreviewDate.UTC = RealDate.UTC;

  (globalThis as { Date: DateConstructor }).Date = PreviewDate as unknown as DateConstructor;
  return offset;
}
