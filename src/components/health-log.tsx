import { StyleSheet, View } from 'react-native';

import { BloodPressureLog } from '@/components/journal/bp-log';
import { BodyLog } from '@/components/journal/body-log';
import { HeartLog } from '@/components/journal/heart-log';
import { MoodLog } from '@/components/journal/mood-log';
import { SleepLog } from '@/components/journal/sleep-log';
import { PremiumGate } from '@/components/premium-gate';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

export type HealthPart = 'sleep' | 'heart' | 'bp' | 'weight' | 'water' | 'mood';

export const HEALTH_PARTS: { value: HealthPart; label: string }[] = [
  { value: 'sleep', label: 'Sleep' },
  { value: 'heart', label: 'Heart' },
  { value: 'bp', label: 'Blood pressure' },
  { value: 'weight', label: 'Weight' },
  { value: 'water', label: 'Water' },
  { value: 'mood', label: 'Mood' },
];

/** A link's `section` as a health part; "body" is the old name for the first of its parts. */
export function healthPart(param: unknown): HealthPart | null {
  if (param === 'body') return 'bp';
  return HEALTH_PARTS.some((p) => p.value === param) ? (param as HealthPart) : null;
}

/**
 * The health readings (once the Journal tab): a chip per part and the part's
 * log. Every part is premium; the chips stay, so a free account can see
 * what's in each.
 */
export function HealthLog({ part, onPart }: { part: HealthPart; onPart: (p: HealthPart) => void }) {
  return (
    <>
      <View style={styles.chips} accessibilityRole="tablist">
        {HEALTH_PARTS.map((p) => (
          <Chip key={p.value} label={p.label} selected={p.value === part} onPress={() => onPart(p.value)} />
        ))}
      </View>
      <PremiumGate feature={SCREEN_FEATURES[`journal/${part}`]}>
        {part === 'sleep' ? <SleepLog /> : null}
        {part === 'heart' ? <HeartLog /> : null}
        {part === 'bp' ? <BloodPressureLog /> : null}
        {part === 'weight' || part === 'water' ? <BodyLog key={part} kind={part} /> : null}
        {part === 'mood' ? <MoodLog /> : null}
      </PremiumGate>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
