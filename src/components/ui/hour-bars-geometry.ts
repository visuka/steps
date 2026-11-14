/**
 * The hour chart (spec 5.4 and 10.1) as plain numbers, so jest can check it.
 * 24 slots, bars sit on the bottom edge. Layout is the same for every look.
 */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

const H = CLEAN_SPEC.sizes.hero;

export const HOUR_CHART = {
  slots: 24,
  height: H.chartHeight,
  barWidth: H.barWidth,
  /** Each bar sits 3 dp into its slot (spec 5.4: x = 3 + hour * pitch). */
  barInset: 3,
  tallest: H.tallestBar,
  quietHeight: H.quietBar,
  /** Spec 10.1: any hour with at least one step is at least this high. */
  minBarHeight: 4,
  /** Spec 10.1: waking hours 6 am to 10 pm. */
  wakingHours: 16,
  /** Spec 10.1: scaleMax is at least this many goal-hours. */
  goalHeadroom: 1.5,
  /** Spec 10.1: the goal line never rises above this y, so the label fits. */
  goalLineTop: 24,
  goalStroke: 1,
  goalDash: [3, 4] as const,
  /** Spec 5.4: baseline of the "goal pace" label (spec 10.1 only moves the line). */
  labelBaseline: 37,
  labelFontSize: CLEAN_SPEC.type.caption.size,
  labelText: 'goal pace',
} as const;

export interface HourBar {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  /** Drawn behind the goal line in the quiet colour. */
  quiet: boolean;
}

export interface HourBarsGeometry {
  bars: HourBar[];
  /** null when there is no goal. */
  goalLineY: number | null;
  pitch: number;
  scaleMax: number;
}

export interface HourBarsInput {
  /** Steps for hours 0 to 23. */
  hours: readonly number[];
  goal: number;
  width: number;
  /** Today's current hour: later hours are drawn quiet even if they hold data. */
  now?: number | null;
}

export function hourBars({ hours, goal, width, now }: HourBarsInput): HourBarsGeometry {
  const pitch = width / HOUR_CHART.slots;
  const steps = Array.from({ length: HOUR_CHART.slots }, (_, h) => {
    const v = hours[h] ?? 0;
    if (now != null && h > now) return 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const goalPerHour = goal > 0 ? goal / HOUR_CHART.wakingHours : 0;
  const scaleMax = Math.max(...steps, goalPerHour * HOUR_CHART.goalHeadroom);
  const bars = steps.map((s, h): HourBar => {
    const quiet = s <= 0;
    const height = quiet ? HOUR_CHART.quietHeight : Math.max(HOUR_CHART.minBarHeight, (s / scaleMax) * HOUR_CHART.tallest);
    return {
      x: HOUR_CHART.barInset + h * pitch,
      y: HOUR_CHART.height - height,
      width: HOUR_CHART.barWidth,
      height,
      rx: quiet ? HOUR_CHART.quietHeight / 2 : HOUR_CHART.barWidth / 2,
      quiet,
    };
  });
  const goalLineY =
    goalPerHour > 0 && scaleMax > 0
      ? Math.max(HOUR_CHART.goalLineTop, HOUR_CHART.height - (goalPerHour / scaleMax) * HOUR_CHART.tallest)
      : null;
  return { bars, goalLineY, pitch, scaleMax };
}

/** 6240 -> '6,240' (own formatter: toLocaleString differs between Hermes and node). */
export function groupThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function hour12(h: number): number {
  return h % 12 === 0 ? 12 : h % 12;
}

/** Hour 7 -> '7 to 8 am'; hour 11 -> '11 am to 12 pm'; hour 23 -> '11 pm to 12 am'. */
export function hourRange(h: number): string {
  const end = (h + 1) % 24;
  const sfx = (x: number) => (x < 12 ? 'am' : 'pm');
  return sfx(h) === sfx(end)
    ? `${hour12(h)} to ${hour12(end)} ${sfx(h)}`
    : `${hour12(h)} ${sfx(h)} to ${hour12(end)} ${sfx(end)}`;
}

/** The chart's spoken summary: the total is the sum of the data. */
export function hourBarsLabel(hours: readonly number[], goal: number): string {
  const steps = Array.from({ length: HOUR_CHART.slots }, (_, h) => Math.max(0, hours[h] ?? 0));
  const total = steps.reduce((a, b) => a + b, 0);
  if (total <= 0) return 'Steps by hour: no steps yet';
  const busiest = steps.indexOf(Math.max(...steps));
  const goalText = goal > 0 ? `, goal ${groupThousands(goal)}` : '';
  return `Steps by hour: ${groupThousands(total)} steps in total, busiest hour ${hourRange(busiest)} with ${groupThousands(steps[busiest])}${goalText}`;
}
