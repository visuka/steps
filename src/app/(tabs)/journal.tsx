import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Segmented } from '@/components/controls';
import { BodyLog } from '@/components/journal/body-log';
import { FoodLog } from '@/components/journal/food-log';
import { MoodLog } from '@/components/journal/mood-log';
import { Screen } from '@/components/screen';

type Section = 'mood' | 'food' | 'weight' | 'water';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'mood', label: 'Mood' },
  { value: 'food', label: 'Food' },
  { value: 'weight', label: 'Weight' },
  { value: 'water', label: 'Water' },
];

const isSection = (s: unknown): s is Section => SECTIONS.some((x) => x.value === s);

export default function JournalScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<Section>(isSection(params.section) ? params.section : 'mood');
  const [lastParam, setLastParam] = useState(params.section);
  // Links from Today ("Log food") switch the section even when the tab is already mounted.
  if (params.section !== lastParam) {
    setLastParam(params.section);
    if (isSection(params.section)) setSection(params.section);
  }

  return (
    <Screen title="Journal">
      <Segmented options={SECTIONS} value={section} onChange={setSection} />
      {section === 'mood' ? <MoodLog /> : null}
      {section === 'food' ? <FoodLog /> : null}
      {section === 'weight' || section === 'water' ? <BodyLog key={section} kind={section} /> : null}
    </Screen>
  );
}
