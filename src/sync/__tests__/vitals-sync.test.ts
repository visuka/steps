import { describe, expect, it, jest } from '@jest/globals';

import { openRepository } from '@/data/db.web';
import { deleteBloodPressure } from '@/data/entries';
import type { BloodPressureEntry } from '@/data/types';
import { vitalsSource } from '@/health/vitals';
import { syncVitals } from '@/sync/vitals-sync';

/** Health Connect as the phone has it: its readings, and a delete that can be made to fail. */
const mockHealth = {
  readings: [] as BloodPressureEntry[],
  failDelete: true,
  deleted: [] as string[],
};

jest.mock('@/health/vitals', () => ({
  get vitalsSource() {
    return {
      label: 'Health Connect',
      isAvailable: async () => true,
      requestAccess: async () => true,
      readSleep: async () => [],
      readHeartDays: async () => [],
      readBloodPressure: async () => mockHealth.readings.filter((r) => !mockHealth.deleted.includes(r.healthId ?? '')),
      writeBloodPressure: async () => null,
      deleteBloodPressure: async (entry: { healthId: string | null }) => {
        if (mockHealth.failDelete) throw new Error('Health Connect is updating');
        mockHealth.deleted.push(entry.healthId ?? '');
      },
    };
  },
}));

describe('blood pressure from Health Connect', () => {
  it('doesn’t bring back a reading deleted here when its copy there couldn’t be deleted', async () => {
    const repo = await openRepository();
    await repo.setKv('vitalsConnected', true);
    const mine: BloodPressureEntry = {
      id: 'bp1',
      loggedAt: Date.now() - 3_600_000,
      systolic: 130,
      diastolic: 85,
      pulse: null,
      source: 'manual',
      healthId: 'hc-1',
      updatedAt: 1,
    };
    await repo.saveBloodPressure(mine);
    mockHealth.readings = [
      { ...mine, id: 'health:hc-1', source: 'health' },
      { ...mine, id: 'health:hc-2', healthId: 'hc-2', systolic: 118, source: 'health' },
    ];

    expect(await deleteBloodPressure(repo, vitalsSource, mine)).toBe('failed');
    await syncVitals(repo, true);
    const ids = async () => (await repo.getBloodPressure(0, Number.MAX_SAFE_INTEGER)).map((b) => b.id);
    // Only the other app's reading; the deleted one's copy stays out.
    expect(await ids()).toEqual(['health:hc-2']);

    // Health Connect works again: the copy is deleted there, and still nothing comes back.
    mockHealth.failDelete = false;
    await syncVitals(repo, true);
    expect(mockHealth.deleted).toEqual(['hc-1']);
    expect(await ids()).toEqual(['health:hc-2']);
    await syncVitals(repo, true);
    expect(await ids()).toEqual(['health:hc-2']);
  });
});
