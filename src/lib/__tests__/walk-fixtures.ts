/**
 * Recorded-style walks for the walk tests: a known true path, then GPS the
 * way phones report it (white noise, slow drift, multipath excursions,
 * accuracy that's sometimes optimistic), the walk counter's cumulative rows
 * every 5 s, barometer rows every 5 s and Activity Recognition results.
 * Seeded, so every run is the same.
 */
import type { ActivitySample, ArType, PressureSample, StepSample, WalkPoint } from '@/lib/walk';

/** Thu 13 Nov 2026, 7:00 local, as a fixed origin. */
export const T0 = new Date(2026, 10, 13, 7, 0, 0).getTime();
const ORIGIN = { lat: 12.9716, lon: 77.5946 };
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

export const toLatLon = (x: number, y: number) => ({ lat: ORIGIN.lat + y / M_PER_DEG_LAT, lon: ORIGIN.lon + x / M_PER_DEG_LON });

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number): number {
  const u = Math.max(1e-12, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** A path: position in metres (east, north) and speed at second s from the start. */
export interface Path {
  seconds: number;
  at(s: number): { x: number; y: number; speed: number };
}

/** Straight north at a steady speed, starting at (x0, y0). */
export function straight(seconds: number, speedMs: number, x0 = 0, y0 = 0, headingDeg = 0): Path {
  const h = (headingDeg * Math.PI) / 180;
  return { seconds, at: (s) => ({ x: x0 + Math.sin(h) * speedMs * s, y: y0 + Math.cos(h) * speedMs * s, speed: speedMs }) };
}

/** Laps of a w x h rectangle (a small park), anticlockwise from the south-west corner. */
export function laps(seconds: number, speedMs: number, w: number, h: number): Path {
  const perimeter = 2 * (w + h);
  return {
    seconds,
    at(s) {
      let d = (speedMs * s) % perimeter;
      if (d < w) return { x: d, y: 0, speed: speedMs };
      d -= w;
      if (d < h) return { x: w, y: d, speed: speedMs };
      d -= h;
      if (d < w) return { x: w - d, y: h, speed: speedMs };
      d -= w;
      return { x: 0, y: h - d, speed: speedMs };
    },
  };
}

/** Standing at (x, y). */
export function standing(seconds: number, x = 0, y = 0): Path {
  return { seconds, at: () => ({ x, y, speed: 0 }) };
}

/** Paths one after another, each continuing from where the last ended. */
export function chain(...paths: Path[]): Path {
  const total = paths.reduce((s, p) => s + p.seconds, 0);
  const offsets: { x: number; y: number }[] = [];
  let ox = 0;
  let oy = 0;
  for (const p of paths) {
    offsets.push({ x: ox, y: oy });
    const end = p.at(p.seconds);
    const start = p.at(0);
    ox += end.x - start.x;
    oy += end.y - start.y;
  }
  return {
    seconds: total,
    at(s) {
      let rest = s;
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        if (rest <= p.seconds || i === paths.length - 1) {
          const q = p.at(Math.min(rest, p.seconds));
          const q0 = p.at(0);
          return { x: offsets[i].x + q.x - q0.x, y: offsets[i].y + q.y - q0.y, speed: q.speed };
        }
        rest -= p.seconds;
      }
      return { x: 0, y: 0, speed: 0 };
    },
  };
}

/** True length of a path, m. */
export function pathLength(path: Path, stepS = 0.5): number {
  let d = 0;
  let prev = path.at(0);
  for (let s = stepS; s <= path.seconds; s += stepS) {
    const q = path.at(s);
    d += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return d;
}

export interface GpsNoise {
  seed?: number;
  everyS?: number;
  /** White noise per axis, m. */
  white?: number;
  /** Slow drift per axis (Gauss-Markov), m, and its time constant, s. */
  drift?: number;
  driftTauS?: number;
  /** Multipath excursions: every this many seconds on average, this long, this far. */
  excursionEveryS?: number;
  excursionS?: number;
  excursionM?: number;
  /** Reported accuracy: base plus a share of the real error (phones under-report under trees). */
  accBase?: number;
  accShare?: number;
  /** Doppler speed with its accuracy. */
  doppler?: boolean;
  /** Fixes start this far off and settle over warmS (cold start). */
  warmM?: number;
  warmS?: number;
}

/** GPS fixes for a path. */
export function gpsFor(path: Path, noise: GpsNoise = {}, t0 = T0): WalkPoint[] {
  const r = rng(noise.seed ?? 1);
  const every = noise.everyS ?? 2;
  const white = noise.white ?? 3;
  const driftSigma = noise.drift ?? 0;
  const tau = noise.driftTauS ?? 30;
  const alpha = Math.exp(-every / tau);
  let dx = 0;
  let dy = 0;
  let excursionLeft = 0;
  let excursionLen = 0;
  let exDir = { x: 0, y: 0 };
  const out: WalkPoint[] = [];
  for (let s = 0; s <= path.seconds; s += every) {
    const q = path.at(s);
    dx = alpha * dx + Math.sqrt(1 - alpha * alpha) * driftSigma * gauss(r);
    dy = alpha * dy + Math.sqrt(1 - alpha * alpha) * driftSigma * gauss(r);
    let ex = 0;
    let ey = 0;
    if (excursionLeft <= 0 && noise.excursionEveryS && r() < every / noise.excursionEveryS) {
      excursionLen = noise.excursionS ?? 14;
      excursionLeft = excursionLen;
      const ang = r() * 2 * Math.PI;
      exDir = { x: Math.cos(ang), y: Math.sin(ang) };
    }
    if (excursionLeft > 0) {
      // Out and back, like a fix pulled across a road by a reflection.
      const phase = 1 - excursionLeft / excursionLen;
      const amount = (noise.excursionM ?? 30) * Math.sin(Math.PI * phase);
      ex = exDir.x * amount;
      ey = exDir.y * amount;
      excursionLeft -= every;
    }
    let wx = 0;
    let wy = 0;
    if (noise.warmM && s < (noise.warmS ?? 20)) {
      const left = 1 - s / (noise.warmS ?? 20);
      wx = noise.warmM * left;
      wy = -noise.warmM * left * 0.5;
    }
    const exX = white * gauss(r) + dx + ex + wx;
    const exY = white * gauss(r) + dy + ey + wy;
    const err = Math.hypot(exX, exY);
    const acc = Math.round(((noise.accBase ?? 6) + (noise.accShare ?? 0.4) * err + r() * 2) * 10) / 10;
    const pos = toLatLon(q.x + exX, q.y + exY);
    out.push({
      t: t0 + s * 1000,
      ...pos,
      acc,
      ...(noise.doppler
        ? { speed: Math.max(0, q.speed + 0.15 * gauss(r)), speedAcc: 0.4 + r() * 0.6 }
        : {}),
    });
  }
  return out;
}

/** The walk counter's rows: cumulative steps every 5 s at `spm(s)` steps a minute. */
export function stepRows(seconds: number, spm: (s: number) => number, t0 = T0, everyS = 5): StepSample[] {
  const rows: StepSample[] = [{ t: t0, steps: 0 }];
  let total = 0;
  for (let s = everyS; s <= seconds; s += everyS) {
    let add = 0;
    for (let k = 0; k < everyS; k++) add += spm(s - everyS + k) / 60;
    total += add;
    // Rows exist only when steps happen (the sensor fires on steps).
    if (add > 0.5) rows.push({ t: t0 + s * 1000, steps: Math.round(total) });
  }
  return rows;
}

/** Barometer rows every 5 s for a height profile (m), with noise in hPa. */
export function pressureRows(
  seconds: number,
  heightAt: (s: number) => number,
  opts: { seed?: number; noiseHpa?: number; driftHpaPerS?: number; spikes?: { at: number; s: number; hpa: number }[] } = {},
  t0 = T0,
): PressureSample[] {
  const r = rng(opts.seed ?? 7);
  const rows: PressureSample[] = [];
  for (let s = 0; s <= seconds; s += 5) {
    const h = heightAt(s);
    let hpa = 1013.25 * Math.pow(1 - h / 44330, 5.255);
    hpa += (opts.driftHpaPerS ?? 0) * s;
    hpa += (r() * 2 - 1) * (opts.noiseHpa ?? 0);
    for (const spike of opts.spikes ?? []) {
      // A row is the mean of 5 s: a 3 s spike shows at 3/5 of its size.
      const overlap = Math.max(0, Math.min(s + 2.5, spike.at + spike.s) - Math.max(s - 2.5, spike.at));
      hpa += (spike.hpa * overlap) / 5;
    }
    rows.push({ t: t0 + s * 1000, hpa: Math.round(hpa * 1000) / 1000 });
  }
  return rows;
}

/** AR results every 10 s between from and to (s), with one type and confidence. */
export function arRows(from: number, to: number, type: ArType, conf: number, t0 = T0): ActivitySample[] {
  const rows: ActivitySample[] = [];
  for (let s = from; s <= to; s += 10) {
    rows.push({ t: t0 + s * 1000, type, conf });
    if (conf < 90) rows.push({ t: t0 + s * 1000, type: 'unknown', conf: Math.max(0, 100 - conf - 5) });
  }
  return rows;
}
