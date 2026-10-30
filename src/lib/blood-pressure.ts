/**
 * Blood pressure readings people take at home. Categories follow the American
 * Heart Association's adult ranges; the app shows them to help people read
 * their numbers, not to diagnose anything.
 */
import type { BloodPressureEntry } from '@/data/types';

export type BpCategory = 'low' | 'normal' | 'elevated' | 'stage1' | 'stage2' | 'severe';

export const BP_CATEGORY: Record<BpCategory, { label: string; tone: 'ok' | 'watch' | 'high' }> = {
  low: { label: 'Low', tone: 'watch' },
  normal: { label: 'Normal', tone: 'ok' },
  elevated: { label: 'Elevated', tone: 'watch' },
  stage1: { label: 'High, stage 1', tone: 'watch' },
  stage2: { label: 'High, stage 2', tone: 'high' },
  severe: { label: 'Very high', tone: 'high' },
};

/** The higher of the two numbers decides, as in the AHA chart. */
export function bpCategory(systolic: number, diastolic: number): BpCategory {
  if (systolic >= 180 || diastolic >= 120) return 'severe';
  if (systolic >= 140 || diastolic >= 90) return 'stage2';
  if (systolic >= 130 || diastolic >= 80) return 'stage1';
  if (systolic >= 120) return 'elevated';
  if (systolic < 90 || diastolic < 60) return 'low';
  return 'normal';
}

/** A message for numbers that are probably typos, or null when they look like a real reading. */
export function checkBp(systolic: number | null, diastolic: number | null, pulse: number | null): string | null {
  if (systolic === null || diastolic === null) return 'Enter both numbers.';
  if (systolic < 70 || systolic > 260) return 'The top number (systolic) is usually between 90 and 200. Check it.';
  if (diastolic < 40 || diastolic > 160) return 'The bottom number (diastolic) is usually between 50 and 120. Check it.';
  if (systolic <= diastolic) return 'The top number should be bigger than the bottom one. Check the order.';
  if (pulse !== null && (pulse < 30 || pulse > 220)) return 'That pulse looks off. Check it, or leave it empty.';
  return null;
}

export interface BpAverage {
  systolic: number;
  diastolic: number;
  count: number;
}

export function averageBp(readings: BloodPressureEntry[]): BpAverage | null {
  if (!readings.length) return null;
  return {
    systolic: Math.round(readings.reduce((s, r) => s + r.systolic, 0) / readings.length),
    diastolic: Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length),
    count: readings.length,
  };
}
