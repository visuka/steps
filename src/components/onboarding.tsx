import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Button, NumberField, Row, Segmented, Stepper } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
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

const STEPS = ['welcome', 'profile', 'goal', 'access', 'reminders'] as const;
type Step = (typeof STEPS)[number];

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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <View style={styles.dots}>
              {STEPS.map((s) => (
                <View
                  key={s}
                  style={[styles.dot, { backgroundColor: s === step ? theme.accent : theme.track }]}
                />
              ))}
            </View>

            {step === 'welcome' ? (
              <>
                <Ionicons name="footsteps" size={48} color={theme.accent} />
                <ThemedText type="subtitle">Welcome to {APP_NAME}</ThemedText>
                <ThemedText themeColor="textSecondary">One number, one goal, every day.</ThemedText>
                <Point icon="walk-outline" text="Counts your steps automatically, with no start button." />
                <Point icon="flag-outline" text="A daily goal, streaks and badges keep you moving." />
                <Point icon="lock-closed-outline" text="Your walking data stays on this phone and in your health app." />
                <Button label="Get started" onPress={next} />
              </>
            ) : null}

            {step === 'profile' ? (
              <>
                <ThemedText type="subtitle">About you</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Used to estimate distance and calories. You can change it later.
                </ThemedText>
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
                    onCommit={(v) => v && v > 0 && set({ weightKg: weightToKg(v, units) })}
                  />
                  <Row label="Sex (optional)">
                    <View style={styles.sex}>
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
                  </Row>
                </Card>
                <Button label="Continue" onPress={next} />
              </>
            ) : null}

            {step === 'goal' ? (
              <>
                <ThemedText type="subtitle">Your daily goal</ThemedText>
                <ThemedText themeColor="textSecondary">
                  7,000 steps is a good start. After two weeks the app suggests a goal based on how you walk.
                </ThemedText>
                <Card>
                  <Stepper
                    value={profile.dailyGoal}
                    onChange={(dailyGoal) => set({ dailyGoal })}
                    step={GOAL_STEP}
                    min={MIN_GOAL}
                    max={MAX_GOAL}
                    format={formatSteps}
                  />
                </Card>
                <Button label="Continue" onPress={next} />
              </>
            ) : null}

            {step === 'access' ? (
              <>
                <ThemedText type="subtitle">Step access</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {Platform.OS === 'ios'
                    ? 'The app reads steps, distance and floors from Apple Health, including your Apple Watch. It saves the weight and water you log there too.'
                    : Platform.OS === 'android'
                      ? 'The app reads steps from Health Connect if another app records them. Otherwise it counts with your phone’s step sensor and shows a silent notification while counting.'
                      : 'The web preview runs on demo data.'}
                </ThemedText>
                {source ? (
                  <Card>
                    <Point icon="checkmark-circle" text={`Using ${source.label}.`} />
                    {source.id === 'device-sensor' ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Counting starts now, so today begins at zero.
                      </ThemedText>
                    ) : null}
                  </Card>
                ) : (
                  <Button label={busy ? 'Waiting…' : 'Allow access'} onPress={allowAccess} disabled={busy} />
                )}
                {source ? <Button label="Continue" onPress={next} /> : null}
              </>
            ) : null}

            {step === 'reminders' ? (
              <>
                <ThemedText type="subtitle">Move reminders</ThemedText>
                <ThemedText themeColor="textSecondary">
                  A nudge after an hour with under 250 steps, between 9 am and 8 pm. Change the hours in Settings.
                </ThemedText>
                <Card>
                  <Row label="Remind me to move">
                    <Switch
                      value={profile.reminders.enabled}
                      trackColor={{ true: theme.accent, false: theme.track }}
                      onValueChange={async (enabled) => {
                        const ok = !enabled || (await requestNotificationPermission());
                        set({ reminders: { ...profile.reminders, enabled: enabled && ok } });
                      }}
                    />
                  </Row>
                </Card>
                <Button label={busy ? 'Setting up…' : 'Start walking'} onPress={finish} disabled={busy} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Point({ icon, text }: { icon: ComponentProps<typeof Ionicons>['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={22} color={theme.accent} />
      <ThemedText style={styles.pointText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center' },
  inner: { width: '100%', maxWidth: 520, gap: Spacing.three },
  dots: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: 4 },
  point: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  pointText: { flex: 1 },
  sex: { flexShrink: 1, minWidth: 200 },
});
