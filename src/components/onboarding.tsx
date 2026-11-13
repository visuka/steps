import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useState } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberField, Segmented, Stepper } from '@/components/controls';
import { DietChips } from '@/components/food/food-settings';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, IconButton, type IconName, Notice, Surface, ToggleRow, Why } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { DEFAULT_PROFILE } from '@/data/profile';
import type { Profile, Sex } from '@/data/types';
import { requestMotionPermission } from '@/health/live';
import { setupSource } from '@/health/select-source';
import type { StepSource } from '@/health/types';
import { useTheme } from '@/hooks/use-theme';
import { cmToHeight, formatSteps, heightToCm, heightUnit, kgToWeight, type Units, weightToKg, weightUnit } from '@/lib/format';
import { GOAL_STEP, MAX_GOAL, MIN_GOAL } from '@/lib/goals';
import { requestNotificationPermission } from '@/notifications/notify';
import { useApp } from '@/state/app-state';
import { formatLitres, stepperRange, suggestionBasis, suggestWaterMl } from '@/water/water';

const STEPS = ['welcome', 'profile', 'food', 'goal', 'access', 'reminders'] as const;
type Step = (typeof STEPS)[number];

const ACCESS = Platform.select({
  ios: {
    line: 'Steps, distance and floors from Apple Health.',
    why: 'The app reads steps, distance and floors from Apple Health, including your Apple Watch. It saves the weight and water you log there too.',
  },
  android: {
    line: "From Health Connect, or your phone's own step sensor.",
    why: 'The app reads steps from Health Connect if another app records them. Otherwise it counts with your phone’s step sensor and shows a silent notification while counting.',
  },
  default: { line: 'The web preview runs on demo data.', why: null },
});

export function Onboarding() {
  const { finishOnboarding } = useApp();
  const theme = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [source, setSource] = useState<StepSource | null>(null);
  const [busy, setBusy] = useState(false);
  const units = profile.units;
  const set = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)]);
  const at = STEPS.indexOf(step);
  const back = () => setStep(STEPS[Math.max(0, at - 1)]);

  // System Back goes to the previous step (keeping what was entered) instead of closing the app.
  useEffect(() => {
    if (at === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(STEPS[at - 1]);
      return true;
    });
    return () => sub.remove();
  }, [at]);

  const allowAccess = async () => {
    setBusy(true);
    try {
      await requestMotionPermission();
      setSource(await setupSource());
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const chosen = source ?? (await setupSource());
      await finishOnboarding(profile, chosen);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            {/* Where they are: a straight piece of track, one painted section per step. */}
            <View
              style={styles.progress}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${at + 1} of ${STEPS.length}`}
              accessibilityValue={{ min: 1, max: STEPS.length, now: at + 1 }}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[styles.segment, { backgroundColor: i <= at ? theme.onSurface : theme.lane }]}
                />
              ))}
            </View>
            <View style={styles.stepRow}>
              {at > 0 ? <IconButton icon="arrow-back" accessibilityLabel="Previous step" onPress={back} disabled={busy} /> : null}
              <ThemedText type="labelMedium" themeColor="onSurfaceVariant" importantForAccessibility="no">
                Step {at + 1} of {STEPS.length}
              </ThemedText>
            </View>

            {step === 'welcome' ? (
              <>
                <Heading icon="footsteps" title={`Welcome to ${APP_NAME}`} line="One number, one goal, every day." />
                <Surface level={1} style={styles.points}>
                  <Point icon="walk-outline" text="Counts your steps by itself" />
                  <Point icon="flag-outline" text="A daily goal to aim for" />
                  <Point icon="lock-closed-outline" text="Your walking data stays on your phone" />
                </Surface>
                <Why
                  title={`Welcome to ${APP_NAME}`}
                  label="Tell me more"
                  text={`It counts your steps automatically, with no start button. A daily goal keeps you moving; ${APP_NAME} Premium adds streaks, badges and more. Your walking data stays on this phone and in your health app.`}
                />
                <Button label="Get started" onPress={next} />
              </>
            ) : null}

            {step === 'profile' ? (
              <>
                <Heading title="About you" line="For distance and calories. Change it any time." />
                <Card>
                  <Segmented<Units>
                    options={[
                      { value: 'metric', label: 'Metric' },
                      { value: 'imperial', label: 'Imperial' },
                    ]}
                    value={units}
                    onChange={(u) => set({ units: u })}
                  />
                  <NumberField
                    label="Height"
                    unit={heightUnit(units)}
                    value={cmToHeight(profile.heightCm, units)}
                    onCommit={(v) => v && v > 0 && set({ heightCm: heightToCm(v, units) })}
                  />
                  <NumberField
                    label="Weight"
                    unit={weightUnit(units)}
                    decimals={1}
                    value={kgToWeight(profile.weightKg, units)}
                    onCommit={(v) => v && v > 0 && set({ weightKg: weightToKg(v, units), weightSet: true })}
                  />
                  <View style={styles.sex}>
                    <ThemedText type="bodyLarge">Sex (optional)</ThemedText>
                    <Segmented<Sex>
                      options={[
                        { value: 'unspecified', label: 'Skip' },
                        { value: 'female', label: 'Female' },
                        { value: 'male', label: 'Male' },
                      ]}
                      value={profile.sex}
                      onChange={(sex) => set({ sex })}
                    />
                  </View>
                </Card>
                <Button label="Continue" onPress={next} />
              </>
            ) : null}

            {step === 'food' ? <FoodStep profile={profile} set={set} onNext={next} /> : null}

            {step === 'goal' ? (
              <>
                <Heading title="Your daily goal" line="7,000 steps is a good start." />
                <Card>
                  <Stepper
                    value={profile.dailyGoal}
                    onChange={(dailyGoal) => set({ dailyGoal })}
                    step={GOAL_STEP}
                    min={MIN_GOAL}
                    max={MAX_GOAL}
                    format={formatSteps}
                  />
                  <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.center}>
                    steps a day
                  </ThemedText>
                </Card>
                <Why
                  title="Your daily goal"
                  text="With Premium, after two weeks the app suggests a goal based on how you walk. You can change it any time in You."
                />
                <Button label="Continue" onPress={next} />
              </>
            ) : null}

            {step === 'access' ? (
              <>
                <Heading title="Step access" line={ACCESS.line} />
                {ACCESS.why ? <Why title="Step access" text={ACCESS.why} /> : null}
                {source ? (
                  <>
                    <Notice tone="done" text={`Using ${source.label}.`} />
                    {source.id === 'device-sensor' ? <Notice text="Counting starts now, so today begins at zero." /> : null}
                    <Button label="Continue" onPress={next} />
                  </>
                ) : (
                  <Button label="Allow access" loading={busy} onPress={allowAccess} />
                )}
              </>
            ) : null}

            {step === 'reminders' ? (
              <>
                <Heading title="Move reminders" line="A nudge after an idle hour, 9 am to 8 pm." />
                <Surface level={1}>
                  <ToggleRow
                    icon="notifications-outline"
                    title="Remind me to move"
                    value={profile.reminders.enabled}
                    onValueChange={async (enabled) => {
                      const ok = !enabled || (await requestNotificationPermission());
                      set({ reminders: { ...profile.reminders, enabled: enabled && ok } });
                    }}
                  />
                </Surface>
                <Why
                  title="Move reminders"
                  text="An idle hour is one with under 250 steps. You get a nudge between 9 am and 8 pm. Change the hours in Settings."
                />
                <Button label="Start walking" loading={busy} onPress={finish} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** What they eat and how much water a day: both can be skipped and changed later in You. */
function FoodStep({ profile, set, onNext }: { profile: Profile; set: (p: Partial<Profile>) => void; onNext: () => void }) {
  const units = profile.units;
  const suggested = suggestWaterMl(profile.weightSet ? profile.weightKg : null);
  const range = stepperRange(false);
  const ml = profile.water.targetMl ?? suggested;
  return (
    <>
      <Heading title="Food and water" line="You can change both later in You." />
      <Card>
        <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
          What do you eat?
        </ThemedText>
        <DietChips value={profile.nutrition.diet} onChange={(diet) => set({ nutrition: { ...profile.nutrition, diet } })} />
        <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
          Water a day
        </ThemedText>
        <Stepper
          value={ml}
          onChange={(targetMl) => set({ water: { ...profile.water, targetMl } })}
          step={range.step}
          min={range.min}
          max={range.max}
          format={(v) => formatLitres(v, units)}
        />
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          {suggestionBasis(profile.weightKg, profile.weightSet, units)}
        </ThemedText>
      </Card>
      <Button
        label="Continue"
        onPress={() => {
          set({ water: { ...profile.water, targetMl: ml } });
          onNext();
        }}
      />
      <Button label="Skip" variant="text" onPress={onNext} />
    </>
  );
}

/** The step's title and its one line, with an optional mark above. */
function Heading({ icon, title, line }: { icon?: IconName; title: string; line?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.heading}>
      {icon ? (
        <View style={[styles.mark, { backgroundColor: theme.stepsContainer }]}>
          <Ionicons name={icon} size={32} color={theme.onStepsContainer} />
        </View>
      ) : null}
      <ThemedText type="headlineMedium" accessibilityRole="header">
        {title}
      </ThemedText>
      {line ? (
        <ThemedText type="bodyLarge" themeColor="onSurfaceVariant">
          {line}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={24} color={theme.onSurfaceVariant} />
      <ThemedText type="bodyLarge" style={styles.pointText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center' },
  inner: { width: '100%', maxWidth: 520, gap: Spacing.three },
  progress: { flexDirection: 'row', gap: Spacing.one },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: TouchTarget },
  segment: { flex: 1, height: 8, borderRadius: Radius.xs },
  heading: { gap: Spacing.two, marginTop: Spacing.three, marginBottom: Spacing.one },
  mark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  points: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  point: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', minHeight: 48 },
  pointText: { flex: 1 },
  sex: { gap: Spacing.two },
  center: { textAlign: 'center' },
});
