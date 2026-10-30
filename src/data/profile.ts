import { DEFAULT_GOAL } from '@/lib/goals';
import { strideMeters } from '@/lib/metrics';

import type { Profile, Repository } from './types';

const PROFILE_KEY = 'profile';

export const DEFAULT_PROFILE: Profile = {
  heightCm: 165,
  weightKg: 65,
  sex: 'unspecified',
  birthYear: null,
  units: 'metric',
  strideM: null,
  dailyGoal: DEFAULT_GOAL,
  reminders: { enabled: false, startHour: 9, endHour: 20 },
  moodCheckIn: { enabled: false, hour: 20 },
  onboarded: false,
};

export async function loadProfile(repo: Repository): Promise<Profile> {
  const stored = await repo.getKv<Partial<Profile>>(PROFILE_KEY);
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    reminders: { ...DEFAULT_PROFILE.reminders, ...stored?.reminders },
    moodCheckIn: { ...DEFAULT_PROFILE.moodCheckIn, ...stored?.moodCheckIn },
  };
}

export async function saveProfile(repo: Repository, profile: Profile): Promise<void> {
  await repo.setKv(PROFILE_KEY, profile);
}

export function profileStride(p: Profile): number {
  return strideMeters(p.heightCm, p.strideM, p.sex);
}
