import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { openPicker } from '@/components/buddies/plans/open-picker';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, IconButton, Screen, Snackbar, Surface } from '@/components/ui';
import {
  byTimeOf,
  byTimeWords,
  canAuto,
  DAY_SHORT,
  daysWord,
  EVERY_DAY,
  formOf,
  GOAL_TITLE_MAX,
  goalProblem,
  KIND_ORDER,
  KIND_WORD,
  sameDays,
  stepTarget,
  TARGETS,
  targetWords,
  WEEKDAYS,
  withKind,
} from '@/buddies/goals';
import type { Goal, GoalForm } from '@/buddies/types';
import { useGoalForm } from '@/buddies/use-goals';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';
import { SCREEN_FEATURES } from '@/premium/premium';

/** What every goal form says under Save (the owner's words). */
export const GOAL_FORM_CAPTION = "Members see this goal and that you'll see done or not done. No doses or medical advice.";

/**
 * New goal (captain or vice-captain), or with ?goal= change one: the kind,
 * a name, a target the phone can count, counted by the phone or by tapping,
 * the days, and an optional by-time. Kind and counting stay as made.
 */
export default function GoalFormScreen() {
  const { id, goal } = useLocalSearchParams<{ id: string; goal?: string }>();
  const f = useGoalForm(id, goal || null);
  const editing = !!goal;
  const title = editing ? 'Change goal' : 'New goal';
  const router = useRouter();
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
        <Form key={goal ?? 'new'} title={title} before={f.data} busy={f.busy} save={f.save} back={back} />
      )}
    </PremiumGate>
  );
}

type DaysChoice = 'every' | 'weekdays' | 'pick';

const daysChoiceOf = (days: number[]): DaysChoice =>
  sameDays(days, EVERY_DAY) ? 'every' : sameDays(days, WEEKDAYS) ? 'weekdays' : 'pick';

function Form({
  title,
  before,
  busy,
  save,
  back,
}: {
  title: string;
  before: Goal | null;
  busy: boolean;
  save: (f: GoalForm) => Promise<string | null>;
  back: () => void;
}) {
  const clock = useClockStyle();
  const editing = !!before;
  const [form, setForm] = useState<GoalForm>(() => formOf(before));
  const [days, setDays] = useState<DaysChoice>(() => daysChoiceOf(form.days));
  const [tried, setTried] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const range = TARGETS[form.kind];
  const problem = tried ? goalProblem(form) : null;

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

  const submit = async () => {
    setTried(true);
    if (goalProblem(form)) return;
    const err = await save(form);
    if (err) return show(err);
    back();
  };

  return (
    <Screen title={title} onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      {/* Each part is one block: its label 8 above its content; Screen keeps 16 between blocks. */}
      <Field label="Kind">
        {editing ? (
          <Caption text={`${KIND_WORD[form.kind]}. The kind and how it is counted stay as made.`} />
        ) : (
          <View style={styles.chips}>
            {KIND_ORDER.map((k) => (
              <Chip key={k} label={KIND_WORD[k]} selected={form.kind === k} onPress={() => setForm((x) => withKind(x, k))} />
            ))}
          </View>
        )}
      </Field>

      <Field label="Name">
        <TextField
          label="Name"
          value={form.title}
          onChangeText={(t) => setForm((x) => ({ ...x, title: t }))}
          placeholder="e.g. Morning walk"
          maxLength={GOAL_TITLE_MAX}
        />
      </Field>

      {range ? (
        <Field label="Target">
          <Surface level={1} style={styles.stepper}>
            <IconButton
              icon="remove"
              accessibilityLabel="Less"
              onPress={() => setForm((x) => ({ ...x, target: stepTarget(x.kind, x.target ?? range.start, -1) }))}
              disabled={(form.target ?? range.start) <= range.min}
            />
            <ThemedText type="titleMedium" style={styles.stepValue} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">
              {form.target === null ? 'No target' : targetWords(form.kind, form.target)}
            </ThemedText>
            <IconButton
              icon="add"
              accessibilityLabel="More"
              onPress={() => setForm((x) => ({ ...x, target: stepTarget(x.kind, x.target ?? range.start, 1) }))}
              disabled={(form.target ?? range.start) >= range.max}
            />
          </Surface>
        </Field>
      ) : (
        <Field label="Target">
          <Caption text="No target: members tap Mark done." />
        </Field>
      )}

      <Field label="Counted">
        {editing ? (
          <Caption text={form.counted === 'auto' ? 'By the phone, from its own numbers.' : 'By tapping Mark done.'} />
        ) : (
          <>
            <View style={styles.chips}>
              <Chip
                label="By the phone"
                selected={form.counted === 'auto'}
                disabled={!canAuto(form.kind)}
                onPress={() => setForm((x) => ({ ...x, counted: 'auto', target: x.target ?? TARGETS[x.kind]?.start ?? null }))}
              />
              <Chip label="By tapping" selected={form.counted === 'tap'} onPress={() => setForm((x) => ({ ...x, counted: 'tap' }))} />
            </View>
            <Caption
              text={
                canAuto(form.kind)
                  ? form.counted === 'auto'
                    ? 'Marked done when the phone counts the target.'
                    : 'Members tap Mark done.'
                  : 'Only steps, walks, water and sleep can be counted by the phone.'
              }
            />
          </>
        )}
      </Field>

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

      {problem ? (
        <ThemedText maxFontSizeMultiplier={1.3}>
          {problem}
        </ThemedText>
      ) : null}
      <Button label={editing ? 'Save changes' : 'Add goal'} onPress={submit} loading={busy} disabled={busy} style={styles.gapLarge} />
      <Caption text={GOAL_FORM_CAPTION} />
    </Screen>
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
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  stepValue: { flex: 1, textAlign: 'center' },
});
