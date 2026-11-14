/**
 * Wording and drawing data for the Activity tab and the walk screens. Pure:
 * the screens call these, the tests check them. Short labels only; anything
 * longer sits behind a "Why?".
 */
import type { DistanceSource, PartChoice, Walk, WalkPart, WalkStretches, WeatherCondition } from '@/data/types';
import type { ColorScheme } from '@/constants/tokens';
import { formatDistance, formatDuration, formatSteps, type Units } from '@/lib/format';
import type { MotionLabel } from '@/lib/motion';
import type { WalkActivity, WalkPoint } from '@/lib/walk';
import { isCounted } from '@/lib/walk-totals';

import { inRanges, walkWhen } from './labels';

const KMH_PER_MS = 3.6;
const MPH_PER_MS = 2.236936;

// ── the route on the map ────────────────────────────────────────────────

/**
 * route: the counted main route (solid, steps green). weak: GPS was weak or
 * the distance came from steps there (dashed green). part: a vehicle or
 * cycling stretch that counts (solid, its own colour). left-out: one that
 * doesn't (dashed grey).
 */
export type LineKind = 'route' | 'weak' | 'part' | 'left-out';

export interface RouteLine {
  kind: LineKind;
  /** The part's ord, for part and left-out lines. */
  ord: number | null;
  points: WalkPoint[];
}

type PartLike = Pick<WalkPart, 'ord' | 'choice' | 'defaultKeep'>;

function kindOf(p: WalkPoint, parts: Map<number, PartLike>, stretches: WalkStretches | null | undefined) {
  if (p.part != null) {
    const part = parts.get(p.part);
    return { kind: (part && isCounted(part) ? 'part' : 'left-out') as LineKind, ord: p.part };
  }
  const weak = inRanges(p.t, stretches?.weak) || inRanges(p.t, stretches?.fromSteps);
  return { kind: (weak ? 'weak' : 'route') as LineKind, ord: null };
}

/**
 * Splits a saved walk's fixes into lines to draw, in time order. Each line
 * starts at the last fix of the one before, so the drawing has no gaps; two
 * stretches of main route are never joined straight across a part.
 */
export function routeLines(
  points: WalkPoint[],
  parts: PartLike[],
  stretches?: WalkStretches | null,
): RouteLine[] {
  const byOrd = new Map(parts.map((p) => [p.ord, p]));
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const lines: RouteLine[] = [];
  let current = null as RouteLine | null;
  for (const p of sorted) {
    const { kind, ord } = kindOf(p, byOrd, stretches);
    if (!current || current.kind !== kind || current.ord !== ord) {
      const joint: WalkPoint | undefined = current ? current.points[current.points.length - 1] : undefined;
      current = { kind, ord, points: joint ? [joint, p] : [p] };
      lines.push(current);
    } else {
      current.points.push(p);
    }
  }
  return lines.filter((l) => l.points.length >= 2);
}

/** Which line kinds a map shows, for its legend (colour is never the only sign: dashes and labels too). */
export function legendKinds(lines: RouteLine[]): LineKind[] {
  const order: LineKind[] = ['route', 'weak', 'part', 'left-out'];
  const present = new Set(lines.map((l) => l.kind));
  return order.filter((k) => present.has(k));
}

export const LEGEND_TEXT: Record<LineKind, string> = {
  route: 'Route',
  weak: 'GPS weak',
  part: 'Counted part',
  'left-out': 'Left out',
};

/** Steps green for the route (dashed where weak), marigold for a counted part, outline grey for one left out. */
export function lineColor(c: Pick<ColorScheme, 'steps' | 'near' | 'outline'>, kind: LineKind): string {
  if (kind === 'part') return c.near;
  if (kind === 'left-out') return c.outline;
  return c.steps;
}

export const isDashed = (kind: LineKind) => kind === 'weak' || kind === 'left-out';

type LatLon = Pick<WalkPoint, 'lat' | 'lon'>;
const M_PER_DEG = 111_320;

/** Metres from a to b (flat-earth: exact enough over a walk). */
function legM(a: LatLon, b: LatLon): number {
  const dy = (b.lat - a.lat) * M_PER_DEG;
  const dx = (b.lon - a.lon) * M_PER_DEG * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** The length of a line in metres. */
export function pathLengthM(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += legM(points[i - 1], points[i]);
  return total;
}

/**
 * A line cut into dashes: `onM` metres drawn, `offM` metres skipped, starting
 * with a dash, as runs of [lon, lat]. A dash runs round a corner. The map
 * draws these as plain lines, so a dashed stretch looks the same on every
 * phone (a line style's own dash pattern did not show on the emulator).
 */
export function dashRuns(points: LatLon[], onM: number, offM: number): [number, number][][] {
  if (points.length < 2) return [];
  if (!(onM > 0) || !(offM > 0)) return [points.map((p): [number, number] => [p.lon, p.lat])];
  const cycle = onM + offM;
  const runs: [number, number][][] = [];
  let run: [number, number][] | null = null;
  let phase = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = legM(a, b);
    if (len === 0) continue;
    const at = (d: number): [number, number] => [a.lon + ((b.lon - a.lon) * d) / len, a.lat + ((b.lat - a.lat) * d) / len];
    let d = 0;
    while (d < len) {
      const on = phase < onM;
      const edge = on ? onM : cycle;
      const toEdge = edge - phase;
      let step: number;
      if (len - d >= toEdge) {
        step = toEdge;
        phase = edge;
      } else {
        step = len - d;
        phase += step;
      }
      if (on) {
        if (!run) {
          run = [at(d)];
          runs.push(run);
        }
        run.push(at(d + step));
      } else {
        run = null;
      }
      d += step;
      if (phase >= cycle) phase = 0;
    }
  }
  return runs;
}

// ── the list ────────────────────────────────────────────────────────────

/** "Thu, 30 Oct · 6:10 pm · Indoor · Home", or "… · Koramangala" outdoors. */
export function historyLine(walk: Pick<Walk, 'startedAt' | 'startPlace' | 'indoor'>): string {
  const where = walk.indoor ? (walk.startPlace ? `Indoor · ${walk.startPlace}` : 'Indoor') : walk.startPlace;
  return where ? `${walkWhen(walk.startedAt)} · ${where}` : walkWhen(walk.startedAt);
}

/** The number at the end of a row: the distance, or the time for an indoor ride (no distance). */
export function historyValue(walk: Pick<Walk, 'distanceM' | 'distanceFrom' | 'movingS' | 'startedAt' | 'endedAt'>, units: Units): string {
  if (walk.distanceFrom === 'none') return formatDuration(walk.movingS || (walk.endedAt - walk.startedAt) / 1000);
  return formatDistance(walk.distanceM, units);
}

/** Short tag after the distance when it isn't (all) from GPS: "From steps". */
export function distanceTag(from: DistanceSource | null | undefined): string | null {
  if (from === 'steps') return 'From steps';
  if (from === 'mixed') return 'Partly from steps';
  return null;
}

/** The walk page's one line about where the distance came from; null when there's nothing to say. */
export function distanceSourceText(from: DistanceSource | null | undefined): string | null {
  switch (from) {
    case 'route':
      return 'Distance from your GPS route';
    case 'steps':
      return 'Distance estimated from steps';
    case 'mixed':
      return 'Distance from GPS and steps';
    default:
      return null;
  }
}

export const DISTANCE_WHY =
  'Outdoors the distance comes from your GPS route. Indoors, or where GPS was weak, it is your steps times your stride. Your stride is learned from walks with good GPS.';

// ── speed ───────────────────────────────────────────────────────────────

/** "18.4 km/h" or "11.4 mph"; "—" when unknown. */
export function formatSpeed(ms: number | null | undefined, units: Units): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const v = units === 'metric' ? ms * KMH_PER_MS : ms * MPH_PER_MS;
  return `${v.toFixed(1)} ${units === 'metric' ? 'km/h' : 'mph'}`;
}

/** Speed now, from the newest fix's own speed when it is under 10 s old; null otherwise. */
export function currentSpeedMs(points: Pick<WalkPoint, 't' | 'speed'>[], now: number): number | null {
  const last = points[points.length - 1];
  if (!last || now - last.t > 10_000 || last.speed == null || last.speed < 0) return null;
  return last.speed;
}

export function averageSpeedMs(distanceM: number, movingS: number): number | null {
  return movingS > 0 && distanceM > 0 ? distanceM / movingS : null;
}

/** Ask a rider to confirm after about 3 hours (a forgotten recording). */
export const LONG_RIDE_MS = 3 * 3600_000;

// ── parts (vehicle or cycling stretches) ────────────────────────────────

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** The part card's heading. */
export function partTitle(part: Pick<WalkPart, 'kind'>, activity: WalkActivity = 'walk'): string {
  if (activity === 'ride') return 'Looked like a car';
  if (part.kind === 'vehicle') return 'In a vehicle?';
  if (part.kind === 'cycle') return 'Cycling?';
  return 'Cycling or a vehicle?';
}

/** "4:12 pm–4:19 pm · 1.80 km · 7 min · 40 steps" (steps only when known). */
export function partFacts(part: Pick<WalkPart, 'startT' | 'endT' | 'distanceM' | 'movingS' | 'steps'>, units: Units): string {
  const bits = [
    `${clock(part.startT)}–${clock(part.endT)}`,
    formatDistance(part.distanceM, units),
    formatDuration(part.movingS || (part.endT - part.startT) / 1000),
  ];
  if (part.steps != null) bits.push(`${formatSteps(part.steps)} steps`);
  return bits.join(' · ');
}

/** The button for an answer. */
export function answerLabel(choice: PartChoice, activity: WalkActivity = 'walk'): string {
  if (choice === 'remove') return 'Remove';
  if (choice === 'cycle') return 'Keep as cycling';
  return activity === 'ride' ? 'Keep' : 'Keep, on foot';
}

/** Where the part stands: "Counted as cycling", "Left out", "Left out for now"… */
export function partStatus(part: PartLike, activity: WalkActivity = 'walk'): string {
  switch (part.choice) {
    case 'keep':
      return activity === 'ride' ? 'Kept' : 'Counted as walking';
    case 'cycle':
      return 'Counted as cycling';
    case 'remove':
      return 'Left out';
    default:
      return part.defaultKeep ? 'Counted for now' : 'Left out for now';
  }
}

export const PARTS_WHY =
  'Part of this recording moved like a vehicle or a bicycle. Tell us what it was and the distance, time, steps and calories follow. Your day’s step count does not change.';

// ── stairs ──────────────────────────────────────────────────────────────

export interface StairsView {
  up: number;
  down: number;
  liftUp: number;
  liftDown: number;
}

/** Floors by stairs and by lift, or null without a barometer or with nothing climbed. */
export function stairsView(walk: Pick<Walk, 'floorsUp' | 'floorsDown' | 'liftUp' | 'liftDown'>): StairsView | null {
  if (walk.floorsUp == null && walk.floorsDown == null && walk.liftUp == null && walk.liftDown == null) return null;
  const v = { up: walk.floorsUp ?? 0, down: walk.floorsDown ?? 0, liftUp: walk.liftUp ?? 0, liftDown: walk.liftDown ?? 0 };
  return v.up || v.down || v.liftUp || v.liftDown ? v : null;
}

/** "24 m"; null when unknown. */
export function climbText(climbM: number | null | undefined): string | null {
  return climbM == null ? null : `${Math.round(climbM)} m`;
}

// ── weather ─────────────────────────────────────────────────────────────

/** Ionicons names (no emoji on screens). */
export const WEATHER_ICON: Record<WeatherCondition, 'sunny-outline' | 'partly-sunny-outline' | 'cloudy-outline' | 'rainy-outline' | 'thunderstorm-outline' | 'snow-outline'> = {
  clear: 'sunny-outline',
  partly: 'partly-sunny-outline',
  cloudy: 'cloudy-outline',
  fog: 'cloudy-outline',
  rain: 'rainy-outline',
  storm: 'thunderstorm-outline',
  snow: 'snow-outline',
};

// ── places ──────────────────────────────────────────────────────────────

/** "Home · Office · Gym", or the hint when there are none. */
export function placesLine(names: string[]): string {
  return names.length ? names.join(' · ') : 'Pin places you walk indoors';
}

/** "±12 m". */
export const accuracyText = (acc: number | null | undefined) => (acc == null ? 'Accuracy unknown' : `±${Math.round(acc)} m`);

/** "1.23 km" → ["1.23", "km"], "11:20 /km" → ["11:20", "/km"], "—" → ["—", undefined]: the number big, the unit small. */
export function splitUnit(text: string): [string, string | undefined] {
  const i = text.lastIndexOf(' ');
  return i > 0 ? [text.slice(0, i), text.slice(i + 1)] : [text, undefined];
}

/** The live label's dot: steps green when moving on foot or pedalling, marigold for a guess, grey when still. */
export function labelTone(label: MotionLabel): 'steps' | 'near' | 'outline' {
  if (label === 'vehicle' || label === 'cycling') return 'near';
  if (label === 'still' || label === 'stopped') return 'outline';
  return 'steps';
}
