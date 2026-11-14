/**
 * The walk screen's figures and wording as the Clean+ mockup sets them
 * (docs/design/spec.md 5.11): one decimal for km, the unit apart from the
 * number, "Car 6 min", "removed", "24°C clear", the pace sparkline. Pure, so
 * the tests can check it; walk-detail-look.tsx draws it.
 */

import type { PartChoice, Walk, WalkPart, WalkWeather } from '@/data/types';
import { formatDuration, formatPace, formatSteps, formatTemp, type Units } from '@/lib/format';
import { distanceM, paceSecPerKm, type WalkActivity, type WalkPoint } from '@/lib/walk';
import { isCounted } from '@/lib/walk-totals';
import { averageSpeedMs, formatSpeed, stairsView } from '@/walks/view';
import { CONDITION_LABEL } from '@/weather/met';

const KM_PER_MILE = 1.609344;

/** A number and its unit, drawn apart: "2.3" "km", "32" "min", "3,120". */
export interface Figure {
  value: string;
  unit?: string;
}

/** One decimal, as every mockup: "2.3 km", "1.4 mi". */
export function distanceFigure(meters: number, units: Units): Figure {
  const km = meters / 1000;
  return units === 'metric' ? { value: km.toFixed(1), unit: 'km' } : { value: (km / KM_PER_MILE).toFixed(1), unit: 'mi' };
}

/** "32 min" → "32" "min"; "1 h 05 min" → "1 h 05" "min". */
export function durationFigure(seconds: number): Figure {
  return lastWordApart(formatDuration(seconds));
}

/** "13:55 /km" → "13:55" "/km", "14.2 km/h" → "14.2" "km/h", "—" stays whole. */
export function lastWordApart(text: string): Figure {
  const i = text.lastIndexOf(' ');
  return i > 0 ? { value: text.slice(0, i), unit: text.slice(i + 1) } : { value: text };
}

/**
 * The four numbers under the big one. Walks: time, steps, pace, floors up.
 * Rides: time, average and top speed, climb. Indoor rides (no distance):
 * active kcal and effort, the big number being the time.
 */
export type StatId = 'time' | 'steps' | 'pace' | 'floors' | 'avgSpeed' | 'topSpeed' | 'climb' | 'kcal' | 'effort';

export interface Stat extends Figure {
  id: StatId;
  /** The label as the mockup words it: "Time", "Steps", "Pace", "Climbed". */
  label: string;
}

export interface WalkStats {
  /** The big number: the distance, or an indoor ride's time. */
  hero: Stat | (Figure & { id: 'distance'; label: string });
  stats: Stat[];
}

const EFFORT_TEXT = { easy: 'Easy', steady: 'Steady', hard: 'Hard' } as const;

/** Moving time when known, else the clock time from start to end. */
export function durationOf(walk: Pick<Walk, 'movingS' | 'startedAt' | 'endedAt'>): number {
  return walk.movingS || (walk.endedAt - walk.startedAt) / 1000;
}

export function walkStats(walk: Walk, units: Units): WalkStats {
  const activity = walk.activity ?? 'walk';
  const time: Stat = { id: 'time', label: 'Time', ...durationFigure(durationOf(walk)) };
  if (activity === 'ride' && walk.distanceFrom === 'none') {
    return {
      hero: time,
      stats: [
        { id: 'kcal', label: 'Active kcal', value: formatSteps(walk.activeKcal) },
        { id: 'effort', label: 'Effort', value: walk.effort ? EFFORT_TEXT[walk.effort] : '—' },
      ],
    };
  }
  const hero = { id: 'distance' as const, label: 'Distance', ...distanceFigure(walk.distanceM, units) };
  if (activity === 'ride') {
    return {
      hero,
      stats: [
        time,
        { id: 'avgSpeed', label: 'Avg speed', ...lastWordApart(formatSpeed(averageSpeedMs(walk.distanceM, walk.movingS), units)) },
        { id: 'topSpeed', label: 'Top speed', ...lastWordApart(formatSpeed(walk.topSpeedMs, units)) },
        { id: 'climb', label: 'Climb', ...(walk.climbM == null ? { value: '—' } : { value: String(Math.round(walk.climbM)), unit: 'm' }) },
      ],
    };
  }
  const floors = stairsView(walk)?.up;
  return {
    hero,
    stats: [
      time,
      { id: 'steps', label: 'Steps', value: walk.steps === null ? '—' : formatSteps(walk.steps) },
      { id: 'pace', label: 'Pace', ...lastWordApart(formatPace(paceSecPerKm(walk.distanceM, walk.movingS), units)) },
      {
        id: 'floors',
        label: 'Climbed',
        // Without a barometer (or nothing climbed) the cell stays, with a dash.
        ...(floors == null ? { value: '—' } : { value: String(floors), unit: floors === 1 ? 'floor' : 'floors' }),
      },
    ],
  };
}

/** "24°C clear" (spec 5.11), or null when the walk has no forecast. */
export function weatherText(weather: WalkWeather | null | undefined, units: Units): string | null {
  if (!weather) return null;
  return `${formatTemp(weather.tempC, units)} ${CONDITION_LABEL[weather.condition].toLowerCase()}`;
}

/** The empty state of the weather line, chip or cell. */
export const NO_WEATHER = 'No forecast';

/** "Walk", "Cycle": the main row of the parts list and the selected segment. */
export function activityName(activity: WalkActivity): string {
  return activity === 'ride' ? 'Cycle' : 'Walk';
}

/** The segments, as in every mockup. Only Walk and Cycle can be recorded. */
export const SEGMENTS = ['Walk', 'Run', 'Cycle'] as const;

export interface PartRow {
  ord: number;
  /** "Car", "Cycle", "Car or cycle". */
  name: string;
  /** "6 min". */
  time: string;
  counted: boolean;
  /** "removed", "kept, on foot", "removed for now"… */
  status: string;
  /** The one-tap answer on the row: Keep when it is left out, Remove when it counts. */
  toggle: { choice: PartChoice; label: string };
}

export interface PartsModel {
  /** The walk itself, on foot (or cycling) apart from the parts. */
  main: { name: string; time: string };
  parts: PartRow[];
}

function partName(part: Pick<WalkPart, 'kind'>, activity: WalkActivity): string {
  if (activity === 'ride' || part.kind === 'vehicle') return 'Car';
  if (part.kind === 'cycle') return 'Cycle';
  return 'Car or cycle';
}

/** Where a part stands, as the mockups word it ("removed"). */
export function partStatusShort(part: Pick<WalkPart, 'choice' | 'defaultKeep'>, activity: WalkActivity): string {
  switch (part.choice) {
    case 'keep':
      return activity === 'ride' ? 'kept' : 'kept, on foot';
    case 'cycle':
      return 'kept as cycling';
    case 'remove':
      return 'removed';
    default:
      return part.defaultKeep ? 'counted for now' : 'removed for now';
  }
}

const seconds = (p: Pick<WalkPart, 'startT' | 'endT'>) => Math.max(0, (p.endT - p.startT) / 1000);

export function partsModel(walk: Walk, parts: WalkPart[]): PartsModel {
  const activity = walk.activity ?? 'walk';
  const partsS = parts.reduce((a, p) => a + seconds(p), 0);
  // Clock time less the parts ("Walk 28 min" beside "Car 6 min"); with no parts, the walk's own time.
  const mainS = parts.length ? Math.max(0, (walk.endedAt - walk.startedAt) / 1000 - partsS) : durationOf(walk);
  return {
    main: { name: activityName(activity), time: formatDuration(mainS) },
    parts: parts.map((p) => {
      const counted = isCounted(p);
      return {
        ord: p.ord,
        name: partName(p, activity),
        time: formatDuration(p.movingS || seconds(p)),
        counted,
        status: partStatusShort(p, activity),
        toggle: counted ? { choice: 'remove', label: 'Remove' } : { choice: 'keep', label: 'Keep' },
      };
    }),
  };
}

/** The pace sparkline's box, spec 6.1: 128 x 32, nine points 16 apart. */
export const SPARK = { width: 128, height: 32, samples: 9, top: 10, bottom: 22 } as const;

/**
 * Speed (m/s) at SPARK.samples evenly spaced moments of the walk, each over a
 * window of one eighth of the walk's time, from the distance along its route
 * (parts off the main route are left out). Null when there is no route or no
 * time to spread it over.
 */
export function speedSeries(points: Pick<WalkPoint, 't' | 'lat' | 'lon' | 'part'>[], samples: number = SPARK.samples): number[] | null {
  const pts = points.filter((p) => p.part == null).sort((a, b) => a.t - b.t);
  if (pts.length < 2 || samples < 2) return null;
  const t0 = pts[0].t;
  const span = pts[pts.length - 1].t - t0;
  if (!(span > 0)) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distanceM(pts[i - 1], pts[i]));
  if (!(cum[cum.length - 1] > 0)) return null;
  // Metres travelled by the time t, straight between fixes.
  const at = (t: number): number => {
    if (t <= t0) return 0;
    let i = 1;
    while (i < pts.length - 1 && pts[i].t < t) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
    return cum[i - 1] + (cum[i] - cum[i - 1]) * f;
  };
  const half = span / (samples - 1) / 2;
  const out: number[] = [];
  for (let k = 0; k < samples; k++) {
    const c = t0 + (span * k) / (samples - 1);
    const from = Math.max(t0, c - half);
    const to = Math.min(t0 + span, c + half);
    out.push(to > from ? ((at(to) - at(from)) / (to - from)) * 1000 : 0);
  }
  return out;
}

/**
 * The sparkline's two paths in its 128 x 32 box: the line, and the same
 * polyline closed along the bottom for the area under it. Faster is higher;
 * the values fill the mockup's own range (y 10 to 22), flat at 16 when they
 * are all alike. Null when there is nothing to draw.
 */
export function sparkline(values: number[] | null): { line: string; area: string } | null {
  if (!values || values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const mid = (SPARK.top + SPARK.bottom) / 2;
  // Under 2 % apart is the same speed: flat, not stretched noise.
  const flat = hi - lo <= Math.max(1e-6, 0.02 * hi);
  const n = (x: number) => String(Math.round(x * 100) / 100);
  const pts = values.map((v, i) => {
    const x = (SPARK.width * i) / (values.length - 1);
    const y = flat ? mid : SPARK.bottom - ((v - lo) / (hi - lo)) * (SPARK.bottom - SPARK.top);
    return `${n(x)} ${n(y)}`;
  });
  const line = `M${pts.join(' L')}`;
  return { line, area: `${line} V${SPARK.height} H0Z` };
}
