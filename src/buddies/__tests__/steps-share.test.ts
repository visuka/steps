import { describe, expect, it, jest } from '@jest/globals';

import { memoryRepository } from '@/data/db.web';
import type { DaySummary } from '@/data/types';

import { BOARDS_KEY, rememberBoard, sendSteps, STEPS_SENT_KEY, stepsBody, stepsDue, type StepsBody, weekStartOf } from '../steps-share';

const day = (date: string, steps: number): DaySummary => ({
  date,
  steps,
  untimedSteps: 0,
  distanceM: 0,
  activeKcal: 0,
  activeMin: null,
  walkMin: null,
  briskMin: null,
  runMin: null,
  floors: null,
  goal: 8000,
  source: 'phone' as DaySummary['source'],
  updatedAt: 0,
});

describe('the week', () => {
  it('starts on Monday', () => {
    expect(weekStartOf('2026-11-24')).toBe('2026-11-23'); // Tuesday
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(weekStartOf('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26'); // Sunday, across a month
  });

  it('adds Monday to today only', () => {
    const body = stepsBody([day('2026-11-22', 9999), day('2026-11-23', 4000), day('2026-11-24', 2500.4), day('2026-11-25', 7)], '2026-11-24', 'Asia/Kolkata');
    expect(body).toEqual({ day: '2026-11-24', steps: 2500, weekStart: '2026-11-23', weekSteps: 6500, tz: 'Asia/Kolkata' });
  });
});

describe('when to send', () => {
  const now = 10_000_000;
  it('never while no board is on', () => {
    expect(stepsDue(null, '2026-11-24', 100, now, false)).toBe(false);
  });
  it('at once on a new day, then every 30 minutes when the count changed', () => {
    expect(stepsDue(null, '2026-11-24', 100, now, true)).toBe(true);
    expect(stepsDue({ day: '2026-11-23', steps: 100, at: now }, '2026-11-24', 100, now, true)).toBe(true);
    expect(stepsDue({ day: '2026-11-24', steps: 100, at: now - 60_000 }, '2026-11-24', 300, now, true)).toBe(false);
    expect(stepsDue({ day: '2026-11-24', steps: 100, at: now - 31 * 60_000 }, '2026-11-24', 300, now, true)).toBe(true);
    expect(stepsDue({ day: '2026-11-24', steps: 300, at: now - 99 * 60_000 }, '2026-11-24', 300, now, true)).toBe(false);
  });
});

describe('sending', () => {
  it('sends only with a board on, once, and only the five fields', async () => {
    const repo = memoryRepository(null);
    await repo.upsertDay(day('2026-11-23', 4000));
    await repo.upsertDay(day('2026-11-24', 2500));
    const putSteps = jest.fn(async (_b: StepsBody) => true);
    const deps = { repo, putSteps, today: '2026-11-24', now: 1_000, tz: 'Asia/Kolkata' };

    expect(await sendSteps(deps)).toBe(false);
    expect(putSteps).not.toHaveBeenCalled();

    await rememberBoard(repo, 'KBR000000001', true);
    expect(await sendSteps(deps)).toBe(true);
    expect(putSteps).toHaveBeenCalledTimes(1);
    expect(Object.keys(putSteps.mock.calls[0][0]).sort()).toEqual(['day', 'steps', 'tz', 'weekStart', 'weekSteps']);
    expect(putSteps.mock.calls[0][0].weekSteps).toBe(6500);
    expect(await repo.getKv(STEPS_SENT_KEY)).toEqual({ day: '2026-11-24', steps: 2500, at: 1_000 });

    expect(await sendSteps({ ...deps, now: 2_000 })).toBe(false);
    expect(putSteps).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing when sending fails, so the next try sends', async () => {
    const repo = memoryRepository(null);
    await rememberBoard(repo, 'KBR000000001', true);
    const putSteps = jest.fn(async (_b: StepsBody) => {
      throw new Error('offline');
    });
    expect(await sendSteps({ repo, putSteps, today: '2026-11-24', now: 1 })).toBe(false);
    expect(await repo.getKv(STEPS_SENT_KEY)).toBeNull();
  });

  it('remembers which boards are on', async () => {
    const repo = memoryRepository(null);
    expect(await rememberBoard(repo, 'A', true)).toEqual(['A']);
    expect(await rememberBoard(repo, 'B', true)).toEqual(['A', 'B']);
    expect(await rememberBoard(repo, 'A', true)).toEqual(['A', 'B']);
    expect(await rememberBoard(repo, 'A', false)).toEqual(['B']);
    expect(await repo.getKv(BOARDS_KEY)).toEqual(['B']);
  });
});
