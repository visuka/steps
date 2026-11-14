import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';

import { AccountCard } from '@/components/auth/account-card';
import { confirm } from '@/components/confirm';
import { NameField, NumberField, Segmented, Stepper } from '@/components/controls';
import { CountrySheet } from '@/components/country-sheet';
import { ThemeSheet } from '@/components/theme-sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, Notice, Screen, SectionHeader, Surface, ToggleRow, Why } from '@/components/ui';
import { APP_NAME, SIGN_IN_MODE } from '@/constants/app';
import { ActiveTheme, Spacing } from '@/constants/theme';
import { cleanName, NAME_MAX, profileStride } from '@/data/profile';
import type { Sex } from '@/data/types';
import { switchableSources } from '@/health/select-source';
import type { StepSource } from '@/health/types';
import { countryName } from '@/lib/country';
import { phoneCountry } from '@/lib/country-detect';
import { addDaysToKey, dayKey } from '@/lib/dates';
import { cmToHeight, heightToCm, heightUnit, kgToWeight, type Units, weightToKg, weightUnit } from '@/lib/format';
import { locationAllowed, requestLocation } from '@/location/place';
import { requestNotificationPermission, scheduleMoodCheckIn } from '@/notifications/notify';
import { useApp } from '@/state/app-state';
import { usePremium } from '@/state/use-premium';
import { CONDITION_LABEL } from '@/weather/met';
import { WEATHER_CREDIT } from '@/weather/refresh';

import { StepCounter } from '../../modules/step-counter';

/** Brands whose battery savers stop background apps (dontkillmyapp.com). */
const STRICT_BRANDS = ['oppo', 'realme', 'oneplus', 'vivo', 'iqoo', 'xiaomi', 'redmi', 'poco', 'huawei', 'honor', 'samsung', 'meizu', 'asus', 'tecno', 'infinix', 'itel'];

function stopsBackgroundApps(manufacturer: string | null): boolean {
  const m = manufacturer?.toLowerCase() ?? '';
  return STRICT_BRANDS.some((b) => m.includes(b));
}

const hourLabel = (h: number) => {
  const suffix = h < 12 || h === 24 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
};

const RECORDER_WHY =
  "Google's step recorder (part of Google Play services) keeps the time of every step, even while this app is closed. The app's own counter shows today's steps in a silent notification.";
const STRICT_WHY =
  'The app counts steps itself. This phone stops apps in the background to save battery; steps still count then, but the app can’t tell when they were taken. To keep every step’s time, open this app’s settings and allow background activity (on OPPO, realme and OnePlus: Battery → Allow background activity, and Allow auto launch).';
const COUNTER_WHY =
  'The app counts steps itself and shows them in a silent notification. If counts stop, allow this app to run in the background in battery settings.';
const KEEP_WHY =
  SIGN_IN_MODE === 'phone'
    ? 'To sign you in, our server keeps only a random account number and your email, used just to get your account back if you change phones: no name, no fingerprint. Everything else stays on this phone and in your health app: steps, walks and their routes, moods, food, sleep, health readings and the weather.'
    : 'To sign you in, our server keeps only your passkey’s public key and a random account number: no email, no name, no fingerprint. Everything else stays on this phone and in your health app: steps, walks and their routes, moods, food, sleep, health readings and the weather.';
const FOOD_WHY =
  "When you look up a food or enter a recipe, what you type and your country (from your phone's time zone, or as set under Country) are sent to our server and an AI service to work out what's in it, the way it's usually made where you are. When you log a dish as dine-in or ordered in, its name is sent the same way to get restaurant values. If you say it was from a restaurant, that goes too, with the restaurant's name if you gave one. It's kept without your name, so the same food is quicker for everyone next time.";

export default function SettingsScreen() {
  const { repo, profile, source, updateProfile, switchSource, resetAll, refresh } = useApp();
  const router = useRouter();
  const premium = usePremium();
  const [sources, setSources] = useState<StepSource[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [moodNotice, setMoodNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  // Today's one-time note opens Settings with the picker already up.
  const { appearance } = useLocalSearchParams<{ appearance?: string }>();
  const [themeOpen, setThemeOpen] = useState(appearance === '1');
  const detected = phoneCountry();
  const recorderReady = StepCounter?.recorderStatus() === 'ready';
  const units = profile.units;

  useEffect(() => {
    switchableSources().then(setSources);
    locationAllowed().then(setHasLocation);
  }, []);

  const setMoodCheckIn = async (patch: Partial<typeof profile.moodCheckIn>) => {
    const next = { ...profile.moodCheckIn, ...patch };
    if (next.enabled && !(await requestNotificationPermission())) {
      setMoodNotice('Notifications are off for this app. Turn them on in system settings to get the check-in.');
      return;
    }
    setMoodNotice(null);
    await scheduleMoodCheckIn(next.enabled ? next.hour : null);
    await updateProfile({ moodCheckIn: next });
  };

  const allowLocation = async () => {
    if (await requestLocation()) {
      setHasLocation(true);
      refresh();
    } else {
      // Asked before and refused: only system settings can change it now.
      Linking.openSettings();
    }
  };

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
    const from = addDaysToKey(today, -3650);
    const [rows, moods, weather] = await Promise.all([
      repo.getDays(from, today),
      repo.getMoods(from, today),
      repo.getWeatherRange(from, today),
    ]);
    const moodByDate = new Map(moods.map((m) => [m.date, m.mood]));
    const weatherByDate = new Map(weather.map((w) => [w.date, w]));
    const header =
      'date,steps,steps_no_known_time,distance_m,active_kcal_estimated,active_min,walking_min,brisk_min,running_min,floors,goal,mood_1_to_5,temp_max_c,rain_mm,weather';
    const lines = rows.map((d) => {
      const w = weatherByDate.get(d.date);
      return [
        d.date,
        d.steps,
        d.untimedSteps,
        d.distanceM,
        d.activeKcal,
        d.activeMin ?? '',
        d.walkMin ?? '',
        d.briskMin ?? '',
        d.runMin ?? '',
        d.floors ?? '',
        d.goal,
        moodByDate.get(d.date) ?? '',
        w?.tempMaxC ?? '',
        w?.precipMm ?? '',
        w ? CONDITION_LABEL[w.condition] : '',
      ].join(',');
    });
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

  const strict = stopsBackgroundApps(Device.manufacturer);
  const stepWhy = source.id !== 'device-sensor' ? undefined : recorderReady ? RECORDER_WHY : strict ? STRICT_WHY : COUNTER_WHY;

  return (
    <Screen title="Settings" onBack={() => router.back()}>
      <AccountCard />

      <SectionHeader title="Appearance" />
      <Surface level={1} style={styles.list}>
        <ListRow
          icon="color-palette-outline"
          title="Look"
          supporting={ActiveTheme.name}
          chevron
          onPress={() => setThemeOpen(true)}
          accessibilityHint="Choose how the app looks"
        />
      </Surface>
      <ThemeSheet visible={themeOpen} onClose={() => setThemeOpen(false)} />

      {/* Testers only: a look at the free app without leaving the test. */}
      {premium.canPreviewFree ? (
        <>
          <SectionHeader
            title={`${APP_NAME} Premium`}
            why="Premium is free while we test. The preview shows the app as someone without Premium sees it, so you can check it. Nothing is deleted, and your steps keep counting."
          />
          <Surface level={1} style={styles.list}>
            <ToggleRow
              icon="eye-outline"
              title="Preview as a free user"
              supporting="Premium is free while we test"
              value={premium.previewFree}
              onValueChange={(on) => premium.setPreviewFree(on)}
            />
          </Surface>
        </>
      ) : null}

      <SectionHeader
        title="Profile"
        why="Name sets the greeting on Today; it stays on this phone. Height and stride set distance when your phone doesn’t measure it. Weight sets calorie estimates. Leave stride empty to estimate it from height."
      />
      <Card>
        <NameField
          label="Name (optional)"
          value={profile.name}
          placeholder="—"
          maxLength={NAME_MAX}
          onCommit={(t) => updateProfile({ name: cleanName(t) })}
        />
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
        <View style={styles.sex}>
          <ThemedText type="bodyLarge">Sex (optional)</ThemedText>
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
      </Card>
      <Surface level={1} style={styles.list}>
        <ListRow
          icon="globe-outline"
          title="Country"
          supporting={
            profile.country
              ? (countryName(profile.country) ?? profile.country)
              : `${countryName(detected) ?? 'Not known'} · from your phone`
          }
          chevron
          onPress={() => setCountryOpen(true)}
          accessibilityHint="Food is worked out the way it’s usually made there"
        />
      </Surface>
      <CountrySheet
        visible={countryOpen}
        value={profile.country}
        detected={detected}
        onClose={() => setCountryOpen(false)}
        onPick={(country) => {
          setCountryOpen(false);
          updateProfile({ country });
        }}
      />

      <SectionHeader title="Reminders" />
      <Surface level={1} style={styles.list}>
        <ToggleRow
          icon="walk-outline"
          title="Move reminders"
          supporting="After an idle hour"
          value={profile.reminders.enabled}
          onValueChange={toggleReminders}
        />
        {profile.reminders.enabled ? (
          <View style={styles.inset}>
            <HourStepper
              label="From"
              value={profile.reminders.startHour}
              onChange={(startHour) => updateProfile({ reminders: { ...profile.reminders, startHour } })}
              min={5}
              max={profile.reminders.endHour - 2}
            />
            <HourStepper
              label="Until"
              value={profile.reminders.endHour}
              onChange={(endHour) => updateProfile({ reminders: { ...profile.reminders, endHour } })}
              min={profile.reminders.startHour + 2}
              max={23}
            />
          </View>
        ) : null}
        {notice ? (
          <View style={styles.inset}>
            <Notice tone="problem" text={notice} />
          </View>
        ) : null}

        {/* Mood is premium, and so is its reminder (the setting is kept for when premium is back). */}
        {premium.isLocked('mood') ? null : (
          <>
            <ToggleRow
              icon="happy-outline"
              title="Evening mood check-in"
              supporting="Asks how your day was"
              value={profile.moodCheckIn.enabled}
              onValueChange={(enabled) => setMoodCheckIn({ enabled })}
            />
            {profile.moodCheckIn.enabled ? (
              <View style={styles.inset}>
                <HourStepper
                  label="At"
                  value={profile.moodCheckIn.hour}
                  onChange={(hour) => setMoodCheckIn({ hour })}
                  min={17}
                  max={23}
                />
              </View>
            ) : null}
            {moodNotice ? (
              <View style={styles.inset}>
                <Notice tone="problem" text={moodNotice} />
              </View>
            ) : null}
          </>
        )}
      </Surface>

      <SectionHeader
        title="Location"
        why={`Used only while the app is open: your approximate area for the day's weather, and your route while you record a walk. The app never tracks you in the background. ${WEATHER_CREDIT}.`}
      />
      <Surface level={1} style={styles.list}>
        <ListRow
          icon="location-outline"
          title={hasLocation ? 'Location is allowed' : hasLocation === false ? 'Location is off' : 'Location'}
          supporting="Only while the app is open"
          trailing={
            hasLocation === false ? <Button variant="tonal" compact label="Allow" onPress={allowLocation} /> : undefined
          }
        />
      </Surface>

      <SectionHeader title="Step data" why={stepWhy} />
      <Surface level={1} style={styles.list}>
        <ListRow icon="footsteps-outline" title={source.label} supporting="Where your steps come from" />
        {source.id === 'device-sensor' && !recorderReady ? (
          <ListRow
            icon="battery-half-outline"
            title="Open this app's settings"
            supporting={strict ? 'Allow background activity to keep step times' : 'If counts stop, allow background use'}
            chevron
            onPress={() => Linking.openSettings()}
          />
        ) : null}
        <ListRow
          icon="checkmark-done-outline"
          title="Step check"
          supporting="If your steps look wrong"
          chevron
          onPress={() => router.push('/step-check')}
        />
        {sources.length > 1
          ? sources
              .filter((s) => s.id !== source.id)
              .map((s) => (
                <ListRow key={s.id} icon="swap-horizontal-outline" title={`Switch to ${s.label}`} onPress={() => switchSource(s)} />
              ))
          : null}
      </Surface>

      <SectionHeader title="Your data" />
      <Surface level={1} style={styles.list}>
        <ListRow
          icon="phone-portrait-outline"
          title="Kept on this phone"
          supporting="Steps, walks, food, sleep and readings"
          trailing={<Why title="What we keep" label="(i)" text={KEEP_WHY} />}
        />
        <ListRow
          icon="restaurant-outline"
          title="Food lookups"
          supporting="Sent without your name"
          trailing={<Why title="Food lookups" label="(i)" text={FOOD_WHY} />}
        />
        <ListRow icon="download-outline" title="Export daily totals" supporting="A CSV file" chevron onPress={exportCsv} />
      </Surface>
      {exportError ? <Notice tone="problem" text={exportError} /> : null}
      <Button
        variant="outlined"
        danger
        icon="trash-outline"
        label="Delete all app data"
        onPress={() =>
          confirm(
            'Delete all app data?',
            `This clears ${APP_NAME}'s history, logs and settings on this phone. Data in your health app stays.`,
            resetAll,
          )
        }
      />

      <View style={styles.about}>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.center}>
          {APP_NAME} {Constants.expoConfig?.version ?? ''} · Neutcrafts OPC Private Limited
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.center}>
          For general wellness only. Calories and distance are estimates, not medical advice.
        </ThemedText>
      </View>
    </Screen>
  );
}

/** An hour of the day with − and +, under its label. */
function HourStepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (h: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.hour}>
      <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
        {label}
      </ThemedText>
      <Stepper value={value} onChange={onChange} step={1} min={min} max={max} format={hourLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  sex: { gap: Spacing.two },
  list: { overflow: 'hidden', paddingVertical: Spacing.one },
  inset: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.three },
  hour: { gap: Spacing.one },
  about: { gap: Spacing.one, marginTop: Spacing.three },
  center: { textAlign: 'center' },
});
