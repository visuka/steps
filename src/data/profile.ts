import { DEFAULT_GOAL } from '@/lib/goals';
import { strideMeters } from '@/lib/metrics';

import type { NutritionSettings, Profile, Repository, WaterSettings } from './types';

const PROFILE_KEY = 'profile';

export const DEFAULT_WATER: WaterSettings = {
  targetMl: null,
  extras: true,
  glassMl: 250,
  remind: false,
  fromHour: 9,
  untilHour: 20,
  doctorLimit: false,
};

/** Tips and the weekly summary start off: permission given for step reminders is not a yes to health pushes. */
export const DEFAULT_NUTRITION: NutritionSettings = {
  diet: null,
  tips: false,
  weekly: false,
  hideCalories: false,
  differentNeeds: false,
};

export const DEFAULT_PROFILE: Profile = {
  heightCm: 165,
  weightKg: 65,
  weightSet: false,
  sex: 'unspecified',
  birthYear: null,
  units: 'metric',
  strideM: null,
  dailyGoal: DEFAULT_GOAL,
  reminders: { enabled: false, startHour: 9, endHour: 20 },
  moodCheckIn: { enabled: false, hour: 20 },
  water: DEFAULT_WATER,
  nutrition: DEFAULT_NUTRITION,
  onboarded: false,
};

/** A change to the profile: nested settings may change one field at a time. */
export type ProfilePatch = Omit<Partial<Profile>, 'reminders' | 'moodCheckIn' | 'water' | 'nutrition'> & {
  reminders?: Partial<Profile['reminders']>;
  moodCheckIn?: Partial<Profile['moodCheckIn']>;
  water?: Partial<WaterSettings>;
  nutrition?: Partial<NutritionSettings>;
};

/**
 * `patch` over `base`, keeping every nested field the patch leaves out. A
 * weight typed in (Settings, a weight log) marks the weight as the person's own.
 */
export function mergeProfile(base: Profile, patch: ProfilePatch | null | undefined): Profile {
  if (!patch) return base;
  const weightSet = patch.weightSet ?? (patch.weightKg !== undefined && patch.weightKg !== base.weightKg ? true : base.weightSet);
  return {
    ...base,
    ...patch,
    weightSet,
    reminders: { ...base.reminders, ...patch.reminders },
    moodCheckIn: { ...base.moodCheckIn, ...patch.moodCheckIn },
    water: { ...base.water, ...patch.water },
    nutrition: { ...base.nutrition, ...patch.nutrition },
  };
}

export async function loadProfile(repo: Repository): Promise<Profile> {
  const stored = await repo.getKv<ProfilePatch>(PROFILE_KEY);
  // A stored profile is the person's own; its weight only counts as typed when it says so.
  return mergeProfile(DEFAULT_PROFILE, stored ? { ...stored, weightSet: stored.weightSet ?? false } : null);
}

export async function saveProfile(repo: Repository, profile: Profile): Promise<void> {
  await repo.setKv(PROFILE_KEY, profile);
}

export function profileStride(p: Profile): number {
  return strideMeters(p.heightCm, p.strideM, p.sex);
}
