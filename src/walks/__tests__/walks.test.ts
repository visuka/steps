import { describe, expect, it } from '@jest/globals';

import type { WalkPart } from '@/data/types';
import type { WalkPoint } from '@/lib/walk';
import { createWalkFeed } from '@/walks/feed';
import { countedRoute, onlyWalks, partAnswers, recordingTitle, walksCount, walkTitle } from '@/walks/labels';
import { parsePlace, toArType, type WalkRecorder } from '@/walks/recorder.types';

describe('walk labels', () => {
  const morning = new Date(2026, 10, 13, 7, 0).getTime();

  it('names rides as cycle rides', () => {
    expect(walkTitle(morning)).toBe('Morning walk');
    expect(walkTitle(morning, 'ride')).toBe('Morning cycle ride');
  });

  it('titles the recording by its mode', () => {
    const place = { id: 'h', name: 'Home', lat: 0, lon: 0, radiusM: 100 };
    expect(recordingTitle({ activity: 'walk', indoorNow: true, place })).toBe('Indoor walk · Home');
    expect(recordingTitle({ activity: 'walk', indoorNow: false, place })).toBe('Walking');
    expect(recordingTitle({ activity: 'ride', indoorNow: true, place: null })).toBe('Indoor cycling');
    expect(recordingTitle(null)).toBe('Walking');
  });

  it('counts walks and rides apart', () => {
    const list = [{ activity: 'walk' as const }, { activity: 'ride' as const }, {}, { activity: 'walk' as const }];
    expect(walksCount(list)).toBe('3 walks · 1 cycle ride');
    expect(onlyWalks(list)).toHaveLength(3);
    expect(walksCount([])).toBe('');
  });

  it('offers three answers on foot, cycling or vehicle, and two in a ride', () => {
    expect(partAnswers({ kind: 'vehicle' })).toEqual(['keep', 'remove', 'cycle']);
    expect(partAnswers({ kind: 'unsure' })).toEqual(['keep', 'cycle', 'remove']);
    expect(partAnswers({ kind: 'vehicle' }, 'ride')).toEqual(['keep', 'remove']);
  });

  it('draws the main route and counted parts only', () => {
    const points: WalkPoint[] = [
      { t: 1, lat: 0, lon: 0, acc: 5, part: null },
      { t: 2, lat: 0, lon: 0, acc: 5, part: 0 },
      { t: 3, lat: 0, lon: 0, acc: 5, part: 1 },
    ];
    const parts = [
      { ord: 0, choice: null, defaultKeep: false },
      { ord: 1, choice: 'keep', defaultKeep: false },
    ] as Pick<WalkPart, 'ord' | 'choice' | 'defaultKeep'>[];
    expect(countedRoute(points, parts).map((p) => p.t)).toEqual([1, 3]);
  });
});

describe('recorder data', () => {
  it('reads the native pin and activity types safely', () => {
    expect(parsePlace('{"id":"h","name":"Home","lat":12.9,"lon":77.6,"radiusM":100}')).toEqual({
      id: 'h',
      name: 'Home',
      lat: 12.9,
      lon: 77.6,
      radiusM: 100,
    });
    expect(parsePlace('{bad')).toBeNull();
    expect(parsePlace('{"id":"h"}')).toBeNull();
    expect(toArType('vehicle')).toBe('vehicle');
    expect(toArType('spaceship')).toBe('unknown');
  });

  it('polls only what is new, never twice at once', async () => {
    const calls: number[] = [];
    let points: WalkPoint[] = [{ t: 10, lat: 0, lon: 0, acc: 5 }];
    const recorder: WalkRecorder = {
      recordsInBackground: true,
      start: async () => 1,
      stop: async () => undefined,
      active: async () => 1,
      isRecording: async () => true,
      points: async (_id, after) => {
        calls.push(after);
        return points.filter((p) => p.t > after);
      },
      steps: async (_id, after) => (after < 20 ? [{ t: 20, steps: 30 }] : []),
      pressure: async () => [],
      activities: async () => [],
      mode: async () => null,
      setIndoor: async () => undefined,
      hasBarometer: async () => false,
      discard: async () => undefined,
    };
    const feed = createWalkFeed(recorder, 1);
    const [a, b] = await Promise.all([feed.poll(), feed.poll()]);
    expect(a).toBe(b);
    expect(calls).toEqual([0]);
    points = [...points, { t: 12, lat: 0, lon: 0, acc: 5 }];
    const next = await feed.poll();
    expect(calls).toEqual([0, 10]);
    expect(next.points.map((p) => p.t)).toEqual([10, 12]);
    expect(next.steps).toEqual([{ t: 20, steps: 30 }]);
    expect(next.version).toBe(2);
    const same = await feed.poll();
    expect(same).toBe(next);
  });
});
