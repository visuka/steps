/**
 * Per-minute movement figures from a short burst of accelerometer readings
 * (T18a: recorded, nothing removed). The same maths as
 * modules/step-counter/.../MovementFeatures.kt, which runs on the phone;
 * keep the two the same. Here it is for tests and for reading the figures.
 *
 * Units: seconds, m/s^2, m/s. A burst is about 10 s at about 25 Hz.
 *
 * Steps:
 * 1. Gravity is a slow low-pass of the readings (seeded by the first second),
 *    so what is left is the phone's own movement. It is split into
 *    up-down (along gravity) and sideways (the flat plane).
 * 2. Rhythm: how well the up-down signal repeats at a step period (0.3 to 1 s).
 * 3. The sideways signal is smoothed over 2 s (footstep jolts cancel), then
 *    projected on its main direction. Forward is the direction in which the
 *    speed grew most; push is the strongest speed-up, braking the hardest slow-down.
 * 4. Speed gained: the smoothed forward acceleration added up over 5 s and
 *    over 10 s windows (restarted for each window); the largest change.
 * 5. Buzz: the share of the shaking energy at or above 6 Hz.
 */

export interface AccelBurst {
  /** Seconds, increasing. */
  t: number[];
  x: number[];
  y: number[];
  z: number[];
}

export interface MovementFeatures {
  /** 0 to 1. */
  rhythm: number;
  /** Strongest forward speed-up, m/s^2 (0 or more). */
  push: number;
  /** Hardest slow-down, m/s^2 (0 or more). */
  brake: number;
  /** Largest speed change over a 5 s or 10 s window, m/s (0 or more). */
  speedGained: number;
  /** 0 to 1. */
  buzz: number;
}

/** Gravity estimate: seeded by the first second, then followed slowly. */
export const GRAVITY_SEED_S = 1;
export const GRAVITY_TAU_S = 30;
export const SMOOTH_S = 2;
export const STEP_PERIOD_MIN_S = 0.3;
export const STEP_PERIOD_MAX_S = 1;
export const BUZZ_FROM_HZ = 6;
export const GAIN_WINDOWS_S = [5, 10];
/** Below this up-down shaking (RMS, m/s^2) there is no rhythm to speak of. */
export const MIN_SHAKE_RMS = 0.1;
/** Below this shaking over all axes (RMS, m/s^2) there is no buzz to speak of. */
export const MIN_BUZZ_RMS = 0.2;
/** A burst shorter than this (s) or with fewer samples gives no figures. */
export const MIN_BURST_S = 4;
export const MIN_SAMPLES = 40;

export const NO_FEATURES: MovementFeatures = { rhythm: 0, push: 0, brake: 0, speedGained: 0, buzz: 0 };

export function computeMovementFeatures(burst: AccelBurst): MovementFeatures {
  const n = burst.t.length;
  if (n < MIN_SAMPLES || burst.x.length !== n || burst.y.length !== n || burst.z.length !== n) return NO_FEATURES;
  const span = burst.t[n - 1] - burst.t[0];
  if (!(span >= MIN_BURST_S)) return NO_FEATURES;
  const rate = (n - 1) / span;

  const split = splitGravity(burst);
  const rhythm = rhythmScore(split.vertical, rate);
  const forward = forwardMotion(split.h1, split.h2, burst.t, rate);
  const buzz = buzzScore(burst, rate);
  return { rhythm, push: forward.push, brake: forward.brake, speedGained: forward.speedGained, buzz };
}

interface Split {
  /** Up-down acceleration without gravity. */
  vertical: number[];
  /** The flat plane, two axes. */
  h1: number[];
  h2: number[];
}

function splitGravity(b: AccelBurst): Split {
  const n = b.t.length;
  const seedEnd = Math.max(1, b.t.findIndex((t) => t - b.t[0] >= GRAVITY_SEED_S));
  let gx = 0;
  let gy = 0;
  let gz = 0;
  for (let i = 0; i < seedEnd; i++) {
    gx += b.x[i];
    gy += b.y[i];
    gz += b.z[i];
  }
  gx /= seedEnd;
  gy /= seedEnd;
  gz /= seedEnd;

  // Two axes across the flat plane, from the seed's gravity direction.
  const g0 = Math.hypot(gx, gy, gz) || 1;
  const ux = gx / g0;
  const uy = gy / g0;
  const uz = gz / g0;
  // Cross gravity with the device axis that is least along it.
  const ax = Math.abs(ux) <= Math.abs(uy) && Math.abs(ux) <= Math.abs(uz) ? 1 : 0;
  const ay = ax === 0 && Math.abs(uy) <= Math.abs(uz) ? 1 : 0;
  const az = ax === 0 && ay === 0 ? 1 : 0;
  let e1x = uy * az - uz * ay;
  let e1y = uz * ax - ux * az;
  let e1z = ux * ay - uy * ax;
  const e1n = Math.hypot(e1x, e1y, e1z) || 1;
  e1x /= e1n;
  e1y /= e1n;
  e1z /= e1n;
  const e2x = uy * e1z - uz * e1y;
  const e2y = uz * e1x - ux * e1z;
  const e2z = ux * e1y - uy * e1x;

  const vertical = new Array<number>(n);
  const h1 = new Array<number>(n);
  const h2 = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const dt = b.t[i] - b.t[i - 1];
      const a = dt / (GRAVITY_TAU_S + dt);
      gx += a * (b.x[i] - gx);
      gy += a * (b.y[i] - gy);
      gz += a * (b.z[i] - gz);
    }
    const gn = Math.hypot(gx, gy, gz) || 1;
    const dx = gx / gn;
    const dy = gy / gn;
    const dz = gz / gn;
    const lx = b.x[i] - gx;
    const ly = b.y[i] - gy;
    const lz = b.z[i] - gz;
    const up = lx * dx + ly * dy + lz * dz;
    vertical[i] = up;
    const hx = lx - up * dx;
    const hy = ly - up * dy;
    const hz = lz - up * dz;
    h1[i] = hx * e1x + hy * e1y + hz * e1z;
    h2[i] = hx * e2x + hy * e2y + hz * e2z;
  }
  return { vertical, h1, h2 };
}

/** The best autocorrelation (0 to 1) at a lag of a step period, 0.3 to 1 s. */
export function rhythmScore(vertical: number[], rate: number): number {
  const n = vertical.length;
  let mean = 0;
  for (const v of vertical) mean += v;
  mean /= n;
  const d = vertical.map((v) => v - mean);
  let energy = 0;
  for (const v of d) energy += v * v;
  if (Math.sqrt(energy / n) < MIN_SHAKE_RMS) return 0;
  const minLag = Math.max(1, Math.round(STEP_PERIOD_MIN_S * rate));
  const maxLag = Math.min(n - 2, Math.round(STEP_PERIOD_MAX_S * rate));
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i + lag < n; i++) {
      sum += d[i] * d[i + lag];
      a += d[i] * d[i];
      b += d[i + lag] * d[i + lag];
    }
    const r = a > 0 && b > 0 ? sum / Math.sqrt(a * b) : 0;
    if (r > best) best = r;
  }
  return Math.min(1, best);
}

/** Moving average over `width` samples around each one; the ends use what exists. */
export function smooth(values: number[], width: number): number[] {
  const n = values.length;
  const half = Math.max(0, Math.floor(width / 2));
  const prefix = new Array<number>(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + values[i];
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - half);
    const to = Math.min(n - 1, i + half);
    out[i] = (prefix[to + 1] - prefix[from]) / (to - from + 1);
  }
  return out;
}

interface Forward {
  push: number;
  brake: number;
  speedGained: number;
}

function forwardMotion(h1: number[], h2: number[], t: number[], rate: number): Forward {
  const n = t.length;
  const width = Math.max(1, Math.round(SMOOTH_S * rate));
  const s1 = smooth(h1, width);
  const s2 = smooth(h2, width);
  // Main direction of the smoothed sideways acceleration.
  let c11 = 0;
  let c22 = 0;
  let c12 = 0;
  for (let i = 0; i < n; i++) {
    c11 += s1[i] * s1[i];
    c22 += s2[i] * s2[i];
    c12 += s1[i] * s2[i];
  }
  const theta = 0.5 * Math.atan2(2 * c12, c11 - c22);
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const p = s1.map((v, i) => v * cs + s2[i] * sn);

  // Speed from the start, by the trapezoid rule; a window's change is the difference of two points.
  const speed = new Array<number>(n);
  speed[0] = 0;
  for (let i = 1; i < n; i++) speed[i] = speed[i - 1] + 0.5 * (p[i] + p[i - 1]) * (t[i] - t[i - 1]);

  let bestChange = 0;
  for (const w of GAIN_WINDOWS_S) {
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (j < i) j = i;
      while (j < n && t[j] - t[i] < w) j++;
      if (j >= n) break;
      const change = speed[j] - speed[i];
      if (Math.abs(change) > Math.abs(bestChange)) bestChange = change;
    }
  }
  // Forward is the way the speed grew most.
  const sign = bestChange < 0 ? -1 : 1;
  let push = 0;
  let brake = 0;
  for (let i = 0; i < n; i++) {
    const f = sign * p[i];
    if (f > push) push = f;
    if (-f > brake) brake = -f;
  }
  return { push, brake, speedGained: Math.abs(bestChange) };
}

/** Share of the shaking energy at or above BUZZ_FROM_HZ (0 to 1); 0 when hardly shaking. */
export function buzzScore(b: AccelBurst, rate: number): number {
  const n = b.t.length;
  let high = 0;
  let all = 0;
  let variance = 0;
  for (const axis of [b.x, b.y, b.z]) {
    let mean = 0;
    for (const v of axis) mean += v;
    mean /= n;
    const windowed = axis.map((v, i) => (v - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
    for (const v of axis) variance += (v - mean) * (v - mean);
    const bins = Math.floor(n / 2);
    for (let k = 1; k <= bins; k++) {
      const step = (2 * Math.PI * k) / n;
      let re = 0;
      let im = 0;
      for (let i = 0; i < n; i++) {
        re += windowed[i] * Math.cos(step * i);
        im -= windowed[i] * Math.sin(step * i);
      }
      const power = re * re + im * im;
      all += power;
      if ((k * rate) / n >= BUZZ_FROM_HZ) high += power;
    }
  }
  if (Math.sqrt(variance / n) < MIN_BUZZ_RMS || all <= 0) return 0;
  return Math.min(1, high / all);
}
