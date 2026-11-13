import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BloodPressureLog } from '@/components/journal/bp-log';
import { BodyLog } from '@/components/journal/body-log';
import { HeartLog } from '@/components/journal/heart-log';
import { MoodLog } from '@/components/journal/mood-log';
import { SleepLog } from '@/components/journal/sleep-log';
import { PremiumGate } from '@/components/premium-gate';
import { Screen } from '@/components/screen';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

type Part = 'sleep' | 'heart' | 'bp' | 'weight' | 'water' | 'mood';

const PARTS: { value: Part; label: string }[] = [
  { value: 'sleep', label: 'Sleep' },
  { value: 'heart', label: 'Heart' },
  { value: 'bp', label: 'Blood pressure' },
  { value: 'weight', label: 'Weight' },
  { value: 'water', label: 'Water' },
  { value: 'mood', label: 'Mood' },
];

/** Links name a part ("bp", "sleep"); "body" is the old name for the first of its parts. Food has its own tab. */
function target(param: unknown): Part | 'food' | null {
  if (param === 'food') return 'food';
  if (param === 'body') return 'bp';
  return PARTS.some((p) => p.value === param) ? (param as Part) : null;
}

export default function JournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const first = target(params.section);
  const [part, setPart] = useState<Part>(first && first !== 'food' ? first : 'sleep');
  const [lastParam, setLastParam] = useState(params.section);
  // Links (Insights, notifications) switch the part even when the tab is already mounted.
  if (params.section !== lastParam) {
    setLastParam(params.section);
    const t = target(params.section);
    if (t && t !== 'food') setPart(t);
  }

  // Old links to the Journal's food section go to the Food tab.
  useEffect(() => {
    if (params.section === 'food') router.navigate('/food');
  }, [params.section, router]);

  // Every part is premium; the chips stay, so a free account can see what's in each.
  return (
    <Screen title="Journal">
      <View style={styles.chips} accessibilityRole="tablist">
        {PARTS.map((p) => (
          <Chip key={p.value} label={p.label} selected={p.value === part} onPress={() => setPart(p.value)} />
        ))}
      </View>
      <PremiumGate feature={SCREEN_FEATURES[`journal/${part}`]}>
        {part === 'sleep' ? <SleepLog /> : null}
        {part === 'heart' ? <HeartLog /> : null}
        {part === 'bp' ? <BloodPressureLog /> : null}
        {part === 'weight' || part === 'water' ? <BodyLog key={part} kind={part} /> : null}
        {part === 'mood' ? <MoodLog /> : null}
      </PremiumGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
