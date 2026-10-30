import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, NumberField, Row, Segmented, Stepper } from '@/components/controls';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { profileStride } from '@/data/profile';
import type { Sex } from '@/data/types';
import { switchableSources } from '@/health/select-source';
import type { StepSource } from '@/health/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey } from '@/lib/dates';
import { cmToHeight, heightToCm, heightUnit, kgToWeight, type Units, weightToKg, weightUnit } from '@/lib/format';
import { requestNotificationPermission } from '@/notifications/notify';
import { useApp } from '@/state/app-state';

const hourLabel = (h: number) => {
  const suffix = h < 12 || h === 24 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
};

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onYes },
  ]);
}

export default function SettingsScreen() {
  const { repo, profile, source, updateProfile, switchSource, resetAll } = useApp();
  const theme = useTheme();
  const [sources, setSources] = useState<StepSource[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const units = profile.units;

  useEffect(() => {
    switchableSources().then(setSources);
  }, []);

  const toggleReminders = async (enabled: boolean) => {
    if (enabled && !(await requestNotificationPermission())) {
      setNotice('Notifications are off for this app. Turn them on in system settings to get reminders.');
      return;
    }
    setNotice(null);
    await updateProfile({ reminders: { ...profile.reminders, enabled } });
  };

  const exportCsv = async () => {
    setExportError(null);
    const today = dayKey(new Date());
    const rows = await repo.getDays(addDaysToKey(today, -3650), today);
    const header = 'date,steps,distance_m,active_kcal_estimated,active_min,floors,goal';
    const lines = rows.map((d) =>
      [d.date, d.steps, d.distanceM, d.activeKcal, d.activeMin ?? '', d.floors ?? '', d.goal].join(','),
    );
    const csv = [header, ...lines].join('\n');
    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = `steps-${today}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        await Share.share({ title: `${APP_NAME} export`, message: csv });
      }
    } catch {
      setExportError("Couldn't open the share sheet. Try again.");
    }
  };

  return (
    <Screen title="Settings">
      <Card title="Profile">
        <Segmented<Units>
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
          value={units}
          onChange={(u) => updateProfile({ units: u })}
        />
        <NumberField
          label="Height"
          unit={heightUnit(units)}
          value={cmToHeight(profile.heightCm, units)}
          commitOnBlur
          onCommit={(v) => v && v > 0 && updateProfile({ heightCm: heightToCm(v, units) })}
        />
        <NumberField
          label="Weight"
          unit={weightUnit(units)}
          decimals={1}
          value={kgToWeight(profile.weightKg, units)}
          commitOnBlur
          onCommit={(v) => v && v > 0 && updateProfile({ weightKg: weightToKg(v, units) })}
        />
        <Row label="Sex (optional)">
          <View style={styles.sex}>
            <Segmented<Sex>
              options={[
                { value: 'unspecified', label: 'Not set' },
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
              value={profile.sex}
              onChange={(sex) => updateProfile({ sex })}
            />
          </View>
        </Row>
        <NumberField
          label="Birth year (optional)"
          value={profile.birthYear}
          placeholder="—"
          commitOnBlur
          onCommit={(v) => updateProfile({ birthYear: v && v > 1900 && v <= new Date().getFullYear() ? v : null })}
        />
        <NumberField
          label="Stride length"
          unit="m"
          decimals={2}
          value={profile.strideM}
          placeholder={`Auto ${profileStride({ ...profile, strideM: null }).toFixed(2)}`}
          commitOnBlur
          onCommit={(v) => updateProfile({ strideM: v && v > 0.3 && v < 1.5 ? v : null })}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Height and stride set distance when your phone doesn’t measure it. Weight sets calorie estimates. Leave
          stride empty to estimate it from height.
        </ThemedText>
      </Card>

      <Card title="Move reminders">
        <Row label="Remind me after an idle hour">
          <Switch
            value={profile.reminders.enabled}
            onValueChange={toggleReminders}
            trackColor={{ true: theme.accent, false: theme.track }}
          />
        </Row>
        {profile.reminders.enabled ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              From
            </ThemedText>
            <Stepper
              value={profile.reminders.startHour}
              onChange={(startHour) => updateProfile({ reminders: { ...profile.reminders, startHour } })}
              step={1}
              min={5}
              max={profile.reminders.endHour - 2}
              format={hourLabel}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Until
            </ThemedText>
            <Stepper
              value={profile.reminders.endHour}
              onChange={(endHour) => updateProfile({ reminders: { ...profile.reminders, endHour } })}
              step={1}
              min={profile.reminders.startHour + 2}
              max={23}
              format={hourLabel}
            />
          </>
        ) : null}
        {notice ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {notice}
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Step data">
        <ThemedText>
          Steps come from <ThemedText type="smallBold">{source.label}</ThemedText>.
        </ThemedText>
        {source.id === 'device-sensor' ? (
          <ThemedText type="small" themeColor="textSecondary">
            The app counts steps itself and shows them in a silent notification. Some phone brands stop background
            apps; if counts stop, allow this app to run in the background in battery settings.
          </ThemedText>
        ) : null}
        {sources.length > 1
          ? sources
              .filter((s) => s.id !== source.id)
              .map((s) => (
                <Button key={s.id} kind="secondary" label={`Switch to ${s.label}`} onPress={() => switchSource(s)} />
              ))
          : null}
      </Card>

      <Card title="Your data">
        <ThemedText type="small" themeColor="textSecondary">
          Everything stays on this phone and in your health app. There is no account and nothing is uploaded.
        </ThemedText>
        <Button kind="secondary" label="Export daily totals (CSV)" onPress={exportCsv} />
        {exportError ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {exportError}
          </ThemedText>
        ) : null}
        <Button
          kind="danger"
          label="Delete all app data"
          onPress={() =>
            confirm(
              'Delete all app data?',
              `This clears ${APP_NAME}'s history, logs and settings on this phone. Data in your health app stays.`,
              resetAll,
            )
          }
        />
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.about}>
        {APP_NAME} {Constants.expoConfig?.version ?? ''} · Neutcrafts OPC Private Limited{'\n'}
        For general wellness only. Calories and distance are estimates, not medical advice.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sex: { flexShrink: 1, minWidth: 220 },
  about: { textAlign: 'center', marginTop: Spacing.two },
});
