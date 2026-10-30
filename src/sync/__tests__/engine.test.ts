import { describe, expect, it } from '@jest/globals';

import { openRepository } from '@/data/db.web';
import { DEFAULT_PROFILE } from '@/data/profile';
import { demoSource } from '@/health/demo-source';
import { addDaysToKey, dayKey } from '@/lib/dates';
import { backfill, DETAIL_DAYS, detailDaysToSync, fillGap, syncRecent } from '@/sync/engine';

const now = new Date(2026, 9, 29, 21, 0);
const profile = { ...DEFAULT_PROFILE, dailyGoal: 1000, onboarded: true };

describe('sync engine', () => {
  it('stores today with minute-level metrics and hourly bars', async () => {
    const repo = await openRepository();
    const { today } = await syncRecent(repo, demoSource, profile, now);

    const buckets = await demoSource.getStepBuckets(new Date(2026, 9, 29), now, 1);
    const expected = buckets.reduce((s, b) => s + b.steps, 0);
    expect(today.steps).toBe(expected);
    expect(today.activeMin).toBeGreaterThan(0);
    expect(today.goal).toBe(1000);

    const hourly = await repo.getHourly(dayKey(now));
    expect(hourly.reduce((a, b) => a + b, 0)).toBe(expected);
  });

  it('backfills a year once, leaving recent days to the detailed sync', async () => {
    const repo = await openRepository();
    await backfill(repo, demoSource, profile, now);
    const older = await repo.getDay(addDaysToKey(dayKey(now), -DETAIL_DAYS));
    expect(older?.activeMin).toBeNull();
    expect(older?.steps).toBeGreaterThan(0);
    expect(await repo.getDay(addDaysToKey(dayKey(now), -1))).toBeNull();

    await repo.upsertDay({ ...older!, steps: 1 });
    await backfill(repo, demoSource, profile, now);
    expect((await repo.getDay(older!.date))?.steps).toBe(1);
  });

  it('keeps a past day’s goal when the goal changes', async () => {
    const repo = await openRepository();
    await syncRecent(repo, demoSource, profile, now);
    await syncRecent(repo, demoSource, { ...profile, dailyGoal: 9000 }, now);
    expect((await repo.getDay(addDaysToKey(dayKey(now), -1)))?.goal).toBe(1000);
    expect((await repo.getDay(dayKey(now)))?.goal).toBe(9000);
  });

  it('leaves no missing days after the first sync', async () => {
    const repo = await openRepository();
    expect(await backfill(repo, demoSource, profile, now)).toBe(true);
    await syncRecent(repo, demoSource, profile, now, DETAIL_DAYS);
    const rows = await repo.getDays(addDaysToKey(dayKey(now), -29), dayKey(now));
    expect(rows.map((r) => r.date)).toEqual(Array.from({ length: 30 }, (_, i) => addDaysToKey(dayKey(now), i - 29)));
  });

  it('re-reads every day since the last sync, within limits', () => {
    expect(detailDaysToSync(null, now)).toBe(DETAIL_DAYS);
    expect(detailDaysToSync(new Date(2026, 9, 29, 8).getTime(), now)).toBe(2);
    expect(detailDaysToSync(new Date(2026, 9, 25, 8).getTime(), now)).toBe(5);
    expect(detailDaysToSync(new Date(2026, 8, 1).getTime(), now)).toBe(DETAIL_DAYS);
  });

  it('fills days missed while the app was closed for weeks', async () => {
    const repo = await openRepository();
    const lastSyncAt = new Date(2026, 9, 1, 12).getTime();
    await fillGap(repo, demoSource, profile, lastSyncAt, now);
    await syncRecent(repo, demoSource, profile, now, detailDaysToSync(lastSyncAt, now));
    const rows = await repo.getDays('2026-10-01', dayKey(now));
    expect(rows).toHaveLength(29);
  });

  it('awards streak and lifetime badges from history', async () => {
    const repo = await openRepository();
    await backfill(repo, demoSource, profile, now);
    const { achievements } = await syncRecent(repo, demoSource, profile, now, DETAIL_DAYS);
    const ids = achievements.map((a) => a.id);
    expect(ids).toContain('streak-7');
    expect(ids).toContain('lifetime-100000');
  });
});
