import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Segmented } from '@/components/controls';
import { BloodPressureLog } from '@/components/journal/bp-log';
import { BodyLog } from '@/components/journal/body-log';
import { FoodLog } from '@/components/journal/food-log';
import { HeartLog } from '@/components/journal/heart-log';
import { MoodLog } from '@/components/journal/mood-log';
import { SleepLog } from '@/components/journal/sleep-log';
import { Screen } from '@/components/screen';

type Section = 'mood' | 'food' | 'sleep' | 'body';
type BodyPart = 'bp' | 'heart' | 'weight' | 'water';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'mood', label: 'Mood' },
  { value: 'food', label: 'Food' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'body', label: 'Body' },
];

const BODY: { value: BodyPart; label: string }[] = [
  { value: 'bp', label: 'BP' },
  { value: 'heart', label: 'Heart' },
  { value: 'weight', label: 'Weight' },
  { value: 'water', label: 'Water' },
];

/** Links can name a section ("food") or a part of Body ("bp"). */
function target(param: unknown): { section: Section; body?: BodyPart } | null {
  if (SECTIONS.some((s) => s.value === param)) return { section: param as Section };
  if (BODY.some((b) => b.value === param)) return { section: 'body', body: param as BodyPart };
  return null;
}

export default function JournalScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const initial = target(params.section);
  const [section, setSection] = useState<Section>(initial?.section ?? 'mood');
  const [body, setBody] = useState<BodyPart>(initial?.body ?? 'bp');
  const [lastParam, setLastParam] = useState(params.section);
  // Links from Today ("Log food") switch the section even when the tab is already mounted.
  if (params.section !== lastParam) {
    setLastParam(params.section);
    const t = target(params.section);
    if (t) {
      setSection(t.section);
      if (t.body) setBody(t.body);
    }
  }

  return (
    <Screen title="Journal">
      <Segmented options={SECTIONS} value={section} onChange={setSection} />
      {section === 'mood' ? <MoodLog /> : null}
      {section === 'food' ? <FoodLog /> : null}
      {section === 'sleep' ? <SleepLog /> : null}
      {section === 'body' ? (
        <>
          <Segmented options={BODY} value={body} onChange={setBody} />
          {body === 'bp' ? <BloodPressureLog /> : null}
          {body === 'heart' ? <HeartLog /> : null}
          {body === 'weight' || body === 'water' ? <BodyLog key={body} kind={body} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
