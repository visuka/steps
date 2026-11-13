import { describe, expect, it } from '@jest/globals';

import type { WalkPart } from '@/data/types';
import type { WalkPoint } from '@/lib/walk';
import {
  answerLabel,
  climbText,
  currentSpeedMs,
  distanceSourceText,
  distanceTag,
  formatSpeed,
  historyLine,
  historyValue,
  labelTone,
  legendKinds,
  partFacts,
  partStatus,
  partTitle,
  placesLine,
  routeLines,
  splitUnit,
  stairsView,
} from '@/walks/view';

const pt = (t: number, part: number | null = null, speed: number | null = null): WalkPoint => ({
  t,
  lat: 12.9 + t / 1e6,
  lon: 77.6,
  acc: 5,
  speed,
  part,
});

const part = (ord: number, extra: Partial<WalkPart> = {}): WalkPart => ({
  walkId: 'w',
  ord,
  startT: 0,
  endT: 0,
  kind: 'vehicle',
  steps: null,
  distanceM: 0,
  movingS: 0,
  topSpeedMs: null,
  kcalWalk: 0,
  kcalRide: 0,
  choice: null,
  defaultKeep: false,
  ...extra,
});

describe('routeLines', () => {
  it('draws one solid line for a plain walk', () => {
    const lines = routeLines([pt(1), pt(2), pt(3)], []);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('route');
    expect(lines[0].points).toHaveLength(3);
  });

  it('splits at a part and never joins the two walking stretches across it', () => {
    const points = [pt(1), pt(2), pt(3, 0), pt(4, 0), pt(5), pt(6)];
    const lines = routeLines(points, [part(0)]);
    expect(lines.map((l) => l.kind)).toEqual(['route', 'left-out', 'route']);
    // Each line begins at the last fix of the one before: no gaps, no shortcut.
    expect(lines[1].points.map((p) => p.t)).toEqual([2, 3, 4]);
    expect(lines[2].points.map((p) => p.t)).toEqual([4, 5, 6]);
  });

  it('shows a kept part as counted, and a removed one as left out', () => {
    const points = [pt(1), pt(2, 0), pt(3, 0), pt(4, 1), pt(5, 1)];
    const lines = routeLines(points, [part(0, { choice: 'cycle' }), part(1, { defaultKeep: true, choice: 'remove' })]);
    expect(lines.map((l) => [l.kind, l.ord])).toEqual([
      ['part', 0],
      ['left-out', 1],
    ]);
  });

  it('dashes the stretches where GPS was weak or the distance came from steps', () => {
    const points = [pt(1), pt(2), pt(3), pt(4), pt(5), pt(6), pt(7)];
    const lines = routeLines(points, [], { weak: [[3, 4]], fromSteps: [[6, 7]] });
    expect(lines.map((l) => l.kind)).toEqual(['route', 'weak', 'route', 'weak']);
    expect(legendKinds(lines)).toEqual(['route', 'weak']);
  });

  it('sorts the fixes and drops a lone point', () => {
    expect(routeLines([pt(1)], [])).toEqual([]);
    const lines = routeLines([pt(3), pt(1), pt(2)], []);
    expect(lines[0].points.map((p) => p.t)).toEqual([1, 2, 3]);
  });
});

describe('list wording', () => {
  const t = new Date(2026, 10, 13, 18, 10).getTime();

  it('names the pin for indoor walks', () => {
    expect(historyLine({ startedAt: t, startPlace: 'Home', indoor: true })).toMatch(/· Indoor · Home$/);
    expect(historyLine({ startedAt: t, startPlace: null, indoor: true })).toMatch(/· Indoor$/);
    expect(historyLine({ startedAt: t, startPlace: 'Koramangala', indoor: false })).toMatch(/· Koramangala$/);
    expect(historyLine({ startedAt: t, startPlace: null })).not.toMatch(/·.*·.*·/);
  });

  it('shows time instead of a distance for an indoor ride', () => {
    const base = { distanceM: 2500, movingS: 1800, startedAt: 0, endedAt: 1_800_000 };
    expect(historyValue({ ...base, distanceFrom: 'route' }, 'metric')).toBe('2.50 km');
    expect(historyValue({ ...base, distanceFrom: 'none' }, 'metric')).toBe('30 min');
  });

  it('says where the distance came from', () => {
    expect(distanceTag('route')).toBeNull();
    expect(distanceTag('steps')).toBe('From steps');
    expect(distanceTag('mixed')).toBe('Partly from steps');
    expect(distanceSourceText('route')).toBe('Distance from your GPS route');
    expect(distanceSourceText(null)).toBeNull();
    expect(distanceSourceText('none')).toBeNull();
  });

  it('lists places, or hints at pinning one', () => {
    expect(placesLine(['Home', 'Gym'])).toBe('Home · Gym');
    expect(placesLine([])).toBe('Pin places you walk indoors');
  });
});

describe('speed', () => {
  it('formats in km/h or mph, and unknown as a dash', () => {
    expect(formatSpeed(5, 'metric')).toBe('18.0 km/h');
    expect(formatSpeed(5, 'imperial')).toBe('11.2 mph');
    expect(formatSpeed(null, 'metric')).toBe('—');
  });

  it('uses only a fresh fix for the speed now', () => {
    expect(currentSpeedMs([pt(1000, null, 4)], 5000)).toBe(4);
    expect(currentSpeedMs([pt(1000, null, 4)], 20_000)).toBeNull();
    expect(currentSpeedMs([pt(1000)], 2000)).toBeNull();
    expect(currentSpeedMs([], 2000)).toBeNull();
  });
});

describe('parts', () => {
  it('asks the right question', () => {
    expect(partTitle({ kind: 'vehicle' })).toBe('In a vehicle?');
    expect(partTitle({ kind: 'unsure' })).toBe('Cycling or a vehicle?');
    expect(partTitle({ kind: 'cycle' }, 'ride')).toBe('Looked like a car');
  });

  it('labels the answers and the state', () => {
    expect(answerLabel('keep')).toBe('Keep, on foot');
    expect(answerLabel('keep', 'ride')).toBe('Keep');
    expect(answerLabel('cycle')).toBe('Keep as cycling');
    expect(answerLabel('remove')).toBe('Remove');
    expect(partStatus(part(0, { choice: 'cycle' }))).toBe('Counted as cycling');
    expect(partStatus(part(0))).toBe('Left out for now');
    expect(partStatus(part(0, { defaultKeep: true }))).toBe('Counted for now');
    expect(partStatus(part(0, { choice: 'keep' }), 'ride')).toBe('Kept');
  });

  it('lists the facts, with steps only when known', () => {
    const p = { startT: 0, endT: 420_000, distanceM: 1800, movingS: 420, steps: null };
    expect(partFacts(p, 'metric')).toMatch(/ · 1\.80 km · 7 min$/);
    expect(partFacts({ ...p, steps: 40 }, 'metric')).toMatch(/ · 7 min · 40 steps$/);
  });
});

describe('stairs and climb', () => {
  it('hides the card without a barometer or with nothing climbed', () => {
    expect(stairsView({ floorsUp: null, floorsDown: null, liftUp: null, liftDown: null })).toBeNull();
    expect(stairsView({ floorsUp: 0, floorsDown: 0, liftUp: 0, liftDown: 0 })).toBeNull();
    expect(stairsView({ floorsUp: 2, floorsDown: 1, liftUp: 3, liftDown: null })).toEqual({ up: 2, down: 1, liftUp: 3, liftDown: 0 });
  });

  it('rounds the climb', () => {
    expect(climbText(23.6)).toBe('24 m');
    expect(climbText(null)).toBeNull();
  });
});

describe('numbers on tiles', () => {
  it('splits the unit off', () => {
    expect(splitUnit('1.23 km')).toEqual(['1.23', 'km']);
    expect(splitUnit('11:20 /km')).toEqual(['11:20', '/km']);
    expect(splitUnit('—')).toEqual(['—', undefined]);
  });

  it('colours the live label dot by how sure it is', () => {
    expect(labelTone('walking')).toBe('steps');
    expect(labelTone('vehicle')).toBe('near');
    expect(labelTone('still')).toBe('outline');
  });
});
