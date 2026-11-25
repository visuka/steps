import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GroupTitle, KindBadge } from '@/components/buddies/goals/goal-parts';
import { useSnack } from '@/components/buddies/parts';
import { openPicker } from '@/components/buddies/plans/open-picker';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, IconButton, ListRow, Screen, Snackbar, Surface } from '@/components/ui';
import {
  amountWords,
  byTimeOf,
  byTimeWords,
  countedWord,
  DAY_SHORT,
  daysWord,
  EVERY_DAY,
  formOf,
  GOAL_TITLE_MAX,
  goalProblem,
  KIND_GROUPS,
  KIND_HOW,
  KIND_ORDER,
  KIND_WORD,
  NUTRIENT_GOALS,
  NUTRIENT_GROUPS,
  nutrientDir,
  rangeOf,
  sameDays,
  stepTarget,
  targetWords,
  WEEKDAYS,
  withKind,
  withNutrient,
  withTarget,
} from '@/buddies/goals';
import type { Goal, GoalForm, GoalKind } from '@/buddies/types';
import { useGoalForm } from '@/buddies/use-goals';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';
import type { Units } from '@/lib/format';
import { NUTRIENT } from '@/nutrition/nutrients';
import type { NutrientKey } from '@/nutrition/types';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';

/** What every goal form says under Save (the owner's words). */
export const GOAL_FORM_CAPTION = "Members see this goal and that you'll see done or not done. No doses or medical advice.";

/** What a goal without a target counts, under Target. */
const NO_TARGET_NOTE: Partial<Record<GoalKind, string>> = {
  heart: 'Done when a heart rate is recorded that day, from a watch or with a blood pressure reading.',
  weight: 'Done when they log their weight that day.',
  mood: 'Done when they log their mood that day.',
};

/**
 * New goal (captain or vice-captain), or with ?goal= change one. A new goal
 * first asks what it is about, in three plain groups (Activity, Health,
 * Food); a nutrient then asks which one. Then a name built from the choice,
 * the target, the days, and an optional by-time. What a goal counts stays as
 * made. ?kind= starts a new goal on that choice (the design preview's shots).
 */
export default function GoalFormScreen() {
  const { id, goal, kind } = useLocalSearchParams<{ id: string; goal?: string; kind?: string }>();
  const f = useGoalForm(id, goal || null);
  const editing = !!goal;
  const title = editing ? 'Change goal' : 'New goal';
  const router = useRouter();
  const startKind = (KIND_ORDER as readonly string[]).includes(kind ?? '') ? (kind as GoalKind) : null;
  const back = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/buddies/club/[id]', params: { id, seg: 'goals' } } as never);
  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
      {(editing && !f.data) || f.loading ? (
        <Screen title={title} onBack={back}>
          <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {f.error ? 'This goal could not be loaded. Go back and try again.' : '—'}
          </ThemedText>
        </Screen>
      ) : (
        <Form key={goal ?? `new-${startKind ?? ''}`} title={title} before={f.data} startKind={startKind} busy={f.busy} save={f.save} back={back} />
      )}
    </PremiumGate>
  );
}

type DaysChoice = 'every' | 'weekdays' | 'pick';

const daysChoiceOf = (days: number[]): DaysChoice =>
  sameDays(days, EVERY_DAY) ? 'every' : sameDays(days, WEEKDAYS) ? 'weekdays' : 'pick';

/** "50 g a day", or "At most 2,000 mg" for a limit. */
function refWords(key: NutrientKey): string {
  const ref = NUTRIENT_GOALS.find((x) => x.key === key)?.ref ?? 0;
  return NUTRIENT[key].group === 'limit' ? `At most ${amountWords(key, ref)}` : `${amountWords(key, ref)} a day`;
}

function Form({
  title,
  before,
  startKind,
  busy,
  save,
  back,
}: {
  title: string;
  before: Goal | null;
  startKind: GoalKind | null;
  busy: boolean;
  save: (f: GoalForm) => Promise<string | null>;
  back: () => void;
}) {
  const clock = useClockStyle();
  const { profile } = useApp();
  const units: Units = profile.units;
  const editing = !!before;
  const [form, setForm] = useState<GoalForm>(() => formOf(before, startKind ?? 'steps', units));
  // A new goal starts on "what is it about?"; changing one never asks again.
  const [picked, setPicked] = useState(editing || startKind !== null);
  const [nutrientOpen, setNutrientOpen] = useState(false);
  const [days, setDays] = useState<DaysChoice>(() => daysChoiceOf(form.days));
  const [tried, setTried] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const range = rangeOf(form.kind, form.nutrientKey, units);
  const problem = tried ? goalProblem(form) : null;
  const listOpen = !editing && form.kind === 'nutrient' && (nutrientOpen || !form.nutrientKey);

  const pickKind = (k: GoalKind) => {
    setForm((x) => (x.kind === k && k !== 'nutrient' ? x : withKind(x, k, units)));
    setNutrientOpen(false);
    setPicked(true);
  };
  const pickNutrient = (key: NutrientKey) => {
    setForm((x) => withNutrient(x, key, units));
    setNutrientOpen(false);
  };
  const pickDays = (c: DaysChoice) => {
    setDays(c);
    if (c === 'every') setForm((x) => ({ ...x, days: [...EVERY_DAY] }));
    if (c === 'weekdays') setForm((x) => ({ ...x, days: [...WEEKDAYS] }));
  };
  const toggleDay = (d: number) =>
    setForm((x) => ({ ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d].sort((a, b) => a - b) }));
  const pickTime = () => {
    const [h, m] = (form.byTime ?? '08:00').split(':').map(Number);
    openPicker?.({
      value: new Date(2026, 0, 1, h, m),
      mode: 'time',
      onValueChange: (_e, t) => setForm((x) => ({ ...x, byTime: byTimeOf(t) })),
    });
  };
  const moveTarget = (by: 1 | -1) =>
    setForm((x) => {
      const r = rangeOf(x.kind, x.nutrientKey, units);
      return r ? withTarget(x, stepTarget(x.kind, x.target ?? r.start, by, x.nutrientKey, units), units) : x;
    });

  const submit = async () => {
    setTried(true);
    if (goalProblem(form)) return;
    const err = await save(form);
    if (err) return show(err);
    back();
  };

  if (!picked) {
    return (
      <Screen title={title} onBack={back}>
        <ThemedText maxFontSizeMultiplier={1.3}>What is the goal about?</ThemedText>
        {KIND_GROUPS.map((g) => (
          <View key={g.title}>
            <GroupTitle title={g.title} first />
            <Surface level={1} style={styles.list}>
              {g.kinds.map((k, i) => (
                <ListRow
                  key={k}
                  title={KIND_WORD[k]}
                  supporting={KIND_HOW[k]}
                  leading={<KindBadge kind={k} />}
                  chevron
                  onPress={() => pickKind(k)}
                  accessibilityLabel={`${KIND_WORD[k]}, ${KIND_HOW[k]}`}
                  last={i === g.kinds.length - 1}
                />
              ))}
            </Surface>
          </View>
        ))}
        <Caption text="Goals count only what this app tracks: some by the phone, the rest from what members log." />
      </Screen>
    );
  }

  const whatTitle = form.kind === 'nutrient' && form.nutrientKey ? NUTRIENT[form.nutrientKey].label : KIND_WORD[form.kind];
  const dir = form.kind === 'nutrient' && form.nutrientKey ? nutrientDir(form.nutrientKey) : null;

  return (
    <Screen title={title} onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      {/* Each part is one block: its label 8 above its content; Screen keeps 16 between blocks. */}
      <Field label="What">
        {editing ? (
          <Caption text={`${whatTitle}. ${countedWord(form.kind, 'members')}. What it counts stays as made.`} />
        ) : (
          <Surface level={1} style={styles.list}>
            <ListRow
              title={KIND_WORD[form.kind]}
              supporting={countedWord(form.kind, 'members')}
              leading={<KindBadge kind={form.kind} />}
              trailingText="Change"
              onPress={() => setPicked(false)}
              accessibilityLabel={`${KIND_WORD[form.kind]}. Change what the goal is about`}
              last
            />
          </Surface>
        )}
      </Field>

      {form.kind === 'nutrient' && !editing ? (
        <Field label="Nutrient">
          {listOpen ? (
            <NutrientList selected={form.nutrientKey} onPick={pickNutrient} />
          ) : form.nutrientKey ? (
            <Surface level={1} style={styles.list}>
              <ListRow
                title={NUTRIENT[form.nutrientKey].label}
                supporting={refWords(form.nutrientKey)}
                trailingText="Change"
                onPress={() => setNutrientOpen(true)}
                accessibilityLabel={`${NUTRIENT[form.nutrientKey].label}. Pick another nutrient`}
                last
              />
            </Surface>
          ) : null}
        </Field>
      ) : null}

      {listOpen ? null : (
        <>
          <Field label="Name">
            <TextField
              label="Name"
              value={form.title}
              onChangeText={(t) => setForm((x) => ({ ...x, title: t }))}
              placeholder="e.g. 8,000 steps"
              maxLength={GOAL_TITLE_MAX}
            />
          </Field>

          {range ? (
            <Field label={dir === 'most' ? 'At most' : dir === 'least' ? 'At least' : 'Target'}>
              <Surface level={1} style={styles.stepper}>
                <IconButton icon="remove" accessibilityLabel="Less" onPress={() => moveTarget(-1)} disabled={(form.target ?? range.start) <= range.min} />
                <ThemedText type="titleMedium" style={styles.stepValue} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">
                  {form.target === null ? 'No target' : targetWords(form.kind, form.target, form.nutrientKey, units)}
                </ThemedText>
                <IconButton icon="add" accessibilityLabel="More" onPress={() => moveTarget(1)} disabled={(form.target ?? range.start) >= range.max} />
              </Surface>
              {dir ? (
                <Caption
                  text={
                    dir === 'most'
                      ? "Done while the day's food stays at or under this, once something is logged."
                      : "Done once the day's food adds up to this."
                  }
                />
              ) : null}
            </Field>
          ) : NO_TARGET_NOTE[form.kind] ? (
            <Field label="Target">
              <Caption text={NO_TARGET_NOTE[form.kind] ?? ''} />
            </Field>
          ) : null}

          <Field label="Days">
            <View style={styles.chips}>
              <Chip label="Every day" selected={days === 'every'} onPress={() => pickDays('every')} />
              <Chip label="Weekdays" selected={days === 'weekdays'} onPress={() => pickDays('weekdays')} />
              <Chip label="Pick days" selected={days === 'pick'} onPress={() => pickDays('pick')} />
            </View>
            {days === 'pick' ? (
              <>
                <View style={styles.chips}>
                  {DAY_SHORT.map((d, i) => (
                    <Chip key={d} label={d} selected={form.days.includes(i)} onPress={() => toggleDay(i)} />
                  ))}
                </View>
                <Caption text={form.days.length ? daysWord(form.days) : 'Pick at least one day.'} />
              </>
            ) : null}
          </Field>

          <Field label="By a time (optional)">
            <View style={styles.chips}>
              <Chip label="No time" selected={!form.byTime} onPress={() => setForm((x) => ({ ...x, byTime: null }))} />
              <Chip
                label={form.byTime ? `By ${byTimeWords(form.byTime, clock)}` : 'Pick a time'}
                selected={!!form.byTime}
                trailingIcon="chevron-down"
                onPress={pickTime}
                disabled={!openPicker}
                accessibilityLabel={form.byTime ? `By ${byTimeWords(form.byTime, clock)}. Change` : 'Pick a time'}
              />
            </View>
          </Field>

          {problem ? <ThemedText maxFontSizeMultiplier={1.3}>{problem}</ThemedText> : null}
          <Button label={editing ? 'Save changes' : 'Add goal'} onPress={submit} loading={busy} disabled={busy} style={styles.gapLarge} />
          <Caption text={GOAL_FORM_CAPTION} />
        </>
      )}
    </Screen>
  );
}

/** The nutrients a goal can count, in four plain groups, each with its daily value or limit. */
function NutrientList({ selected, onPick }: { selected: NutrientKey | null; onPick: (key: NutrientKey) => void }) {
  return (
    <View>
      {NUTRIENT_GROUPS.map((g, gi) => (
        <View key={g.title}>
          <GroupTitle title={g.title} first={gi === 0} />
          <Surface level={1} style={styles.list}>
            {g.keys.map((key, i) => (
              <ListRow
                key={key}
                title={NUTRIENT[key].label}
                supporting={selected === key ? 'Picked' : undefined}
                trailingText={refWords(key)}
                onPress={() => onPick(key)}
                accessibilityLabel={`${NUTRIENT[key].label}, ${refWords(key)}`}
                last={i === g.keys.length - 1}
              />
            ))}
          </Surface>
        </View>
      ))}
    </View>
  );
}

/** A part of the form: its label, then its controls and note, 8 apart. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="titleSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Caption({ text }: { text: string }) {
  return (
    <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gapLarge: { marginTop: Spacing.four },
  list: { overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  stepValue: { flex: 1, textAlign: 'center' },
});
