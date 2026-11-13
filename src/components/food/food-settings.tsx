import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Segmented, Stepper } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ListRow, SectionHeader, Sheet, Surface, Why } from '@/components/ui';
import { Spacing, TouchTarget } from '@/constants/theme';
import type { Diet, GlassMl } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatWater } from '@/lib/format';
import { requestNotificationPermission } from '@/notifications/notify';
import { needsAreDifferent } from '@/nutrition/targets';
import { useApp } from '@/state/app-state';
import { usePremium } from '@/state/use-premium';
import { WATER_SETUP_DISMISSED_KEY, weightKnown } from '@/water/today';
import { formatLitres, stepperRange, suggestionBasis, suggestWaterMl } from '@/water/water';

export const DIET_LABEL: Record<Diet, string> = {
  veg: 'Vegetarian',
  egg: 'Eggetarian',
  nonveg: 'Non-vegetarian',
};
const DIETS: Diet[] = ['veg', 'egg', 'nonveg'];

/** Vegetarian · Eggetarian · Non-vegetarian, wrapping on small screens. */
export function DietChips({ value, onChange }: { value: Diet | null; onChange: (d: Diet) => void }) {
  return (
    <View style={styles.chips}>
      {DIETS.map((d) => (
        <Chip key={d} label={DIET_LABEL[d]} selected={value === d} onPress={() => onChange(d)} />
      ))}
    </View>
  );
}

/** A switch row, 48 dp or more, the label on the left. */
function SwitchRow({ label, value, onChange, why }: { label: string; value: boolean; onChange: (on: boolean) => void; why?: { title: string; text: string } }) {
  const theme = useTheme();
  return (
    <View style={styles.switchRow}>
      <ThemedText type="bodyLarge" style={styles.grow}>
        {label}
      </ThemedText>
      {why ? <Why title={why.title} text={why.text} /> : null}
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.primary, false: theme.surfaceContainerHighest }}
        thumbColor={value ? theme.onPrimary : theme.outline}
      />
    </View>
  );
}

/** The person's suggestion: from their weight, or a common starting point. */
function useSuggestion() {
  const { repo, profile } = useApp();
  const [known, setKnown] = useState(profile.weightSet);
  useEffect(() => {
    let live = true;
    weightKnown(repo, profile).then((k) => live && setKnown(k));
    return () => {
      live = false;
    };
  }, [repo, profile]);
  return {
    ml: suggestWaterMl(known ? profile.weightKg : null),
    basis: suggestionBasis(profile.weightKg, known, profile.units),
  };
}

const NOTIFY_OFF = 'Notifications are off for this app. Turn them on in system settings.';

/** Water: target, glass size, extras, reminders, a doctor's limit. Changes save as they're made. */
export function WaterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, updateProfile } = useApp();
  const w = profile.water;
  const units = profile.units;
  const suggestion = useSuggestion();
  const numbersOnly = needsAreDifferent(profile, new Date().getFullYear());
  const showSuggestion = !w.doctorLimit && !numbersOnly;
  const range = stepperRange(w.doctorLimit);
  const shown = Math.min(range.max, Math.max(range.min, w.targetMl ?? suggestion.ml));
  const [notice, setNotice] = useState<string | null>(null);

  const setRemind = async (remind: boolean) => {
    if (remind && !(await requestNotificationPermission())) {
      setNotice(NOTIFY_OFF);
      return;
    }
    setNotice(null);
    await updateProfile({ water: { remind } });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={w.doctorLimit ? 'Water limit a day' : 'Water a day'}>
      <Stepper
        value={shown}
        onChange={(targetMl) => updateProfile({ water: { targetMl } })}
        step={range.step}
        min={range.min}
        max={range.max}
        format={(ml) => formatLitres(ml, units)}
      />
      {showSuggestion ? (
        <View style={styles.inline}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.grow}>
            Suggested {formatLitres(suggestion.ml, units)} · {suggestion.basis}
          </ThemedText>
          {w.targetMl !== suggestion.ml ? (
            <Button label="Use" variant="text" compact onPress={() => updateProfile({ water: { targetMl: suggestion.ml } })} />
          ) : null}
        </View>
      ) : null}
      {w.targetMl === null ? (
        <Button label={`Save ${formatLitres(shown, units)}`} variant="tonal" onPress={() => updateProfile({ water: { targetMl: shown } })} />
      ) : null}

      <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
        One glass
      </ThemedText>
      <Segmented<`${GlassMl}`>
        options={([200, 250, 300] as const).map((ml) => ({ value: `${ml}` as const, label: formatWater(ml, units) }))}
        value={`${w.glassMl}`}
        onChange={(v) => updateProfile({ water: { glassMl: Number(v) as GlassMl } })}
      />

      {showSuggestion ? (
        <SwitchRow label="Add more on hot or active days" value={w.extras} onChange={(extras) => updateProfile({ water: { extras } })} />
      ) : null}
      {!w.doctorLimit && !numbersOnly ? (
        <>
          <SwitchRow label="Remind me if I'm behind" value={w.remind} onChange={setRemind} />
          {w.remind ? (
            <>
              <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
                Between
              </ThemedText>
              <Stepper
                value={w.fromHour}
                onChange={(fromHour) => updateProfile({ water: { fromHour } })}
                step={1}
                min={6}
                max={w.untilHour - 3}
                format={hourLabel}
              />
              <Stepper
                value={w.untilHour}
                onChange={(untilHour) => updateProfile({ water: { untilHour } })}
                step={1}
                min={w.fromHour + 3}
                max={22}
                format={hourLabel}
              />
            </>
          ) : null}
        </>
      ) : null}
      {notice ? (
        <ThemedText type="bodyMedium" themeColor="error">
          {notice}
        </ThemedText>
      ) : null}
      <SwitchRow
        label="My doctor limits how much I drink"
        value={w.doctorLimit}
        onChange={(doctorLimit) => updateProfile({ water: { doctorLimit, ...(doctorLimit ? { remind: false } : null) } })}
        why={{
          title: 'A doctor’s limit',
          text: 'Your number becomes a most-per-day limit, not a goal. The app stops suggesting amounts, adding extra for heat or steps, and sending reminders.',
        }}
      />
      <Button label="Done" onPress={onClose} />
    </Sheet>
  );
}

/** Food: diet, numbers only, notifications. */
export function FoodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, updateProfile } = useApp();
  const n = profile.nutrition;
  const year = new Date().getFullYear();
  const under18 = needsAreDifferent({ ...profile, nutrition: { ...n, differentNeeds: false } }, year);
  const [notice, setNotice] = useState<string | null>(null);

  const setNotify = async (patch: { tips?: boolean; weekly?: boolean }) => {
    if ((patch.tips || patch.weekly) && !(await requestNotificationPermission())) {
      setNotice(NOTIFY_OFF);
      return;
    }
    setNotice(null);
    await updateProfile({ nutrition: patch });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Food">
      <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
        What do you eat?
      </ThemedText>
      <DietChips value={n.diet} onChange={(diet) => updateProfile({ nutrition: { diet } })} />
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        Food ideas follow this
      </ThemedText>
      {under18 ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          Under 18: numbers only
        </ThemedText>
      ) : (
        <SwitchRow
          label="My needs are different"
          value={n.differentNeeds}
          onChange={(differentNeeds) => updateProfile({ nutrition: { differentNeeds } })}
          why={{
            title: 'Different needs',
            text: 'For pregnancy, breastfeeding, or a diet a doctor guides (kidney, heart, dialysis). The app then shows your numbers only: no Low or Too much, no notes, no food ideas and no water suggestion.',
          }}
        />
      )}
      <SwitchRow label="Food notes as notifications" value={n.tips} onChange={(tips) => setNotify({ tips })} />
      <SwitchRow label="Sunday summary" value={n.weekly} onChange={(weekly) => setNotify({ weekly })} />
      {notice ? (
        <ThemedText type="bodyMedium" themeColor="error">
          {notice}
        </ThemedText>
      ) : null}
      <Button label="Done" onPress={onClose} />
    </Sheet>
  );
}

/** The You tab's "Food and water": a row each, opening its sheet. Hidden when locked. */
export function FoodAndWaterRows() {
  const { profile } = useApp();
  const premium = usePremium();
  const [open, setOpen] = useState<'water' | 'food' | null>(null);
  const suggestion = useSuggestion();
  const w = profile.water;
  const units = profile.units;
  const showWater = !premium.isLocked('body');
  const showFood = !premium.isLocked('food');
  if (!showWater && !showFood) return null;
  const waterText = w.targetMl
    ? `${formatLitres(w.targetMl, units)}${w.doctorLimit ? ' limit' : ''} · ${formatWater(w.glassMl, units)} glass`
    : `Not set · suggested ${formatLitres(suggestion.ml, units)}`;
  const diet = profile.nutrition.diet;
  const foodText = [diet ? DIET_LABEL[diet] : 'Diet not set', profile.nutrition.differentNeeds ? 'numbers only' : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <SectionHeader title="Food and water" />
      <Surface level={1} style={styles.list}>
        {showWater ? (
          <ListRow icon="water-outline" title="Water a day" supporting={waterText} chevron onPress={() => setOpen('water')} />
        ) : null}
        {showFood ? (
          <ListRow icon="restaurant-outline" title="Food" supporting={foodText} chevron onPress={() => setOpen('food')} />
        ) : null}
      </Surface>
      <WaterSheet visible={open === 'water'} onClose={() => setOpen(null)} />
      <FoodSheet visible={open === 'food'} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * Asked once, for people who had the app before: their water a day and what
 * they eat. "Not now" hides it for good; both stay in You → Food and water.
 */
export function FoodSetupCard() {
  const { repo, profile, updateProfile } = useApp();
  const premium = usePremium();
  const suggestion = useSuggestion();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const units = profile.units;
  const w = profile.water;
  const numbersOnly = needsAreDifferent(profile, new Date().getFullYear());
  const askWater = !premium.isLocked('body') && w.targetMl === null && !w.doctorLimit && !numbersOnly;
  const askDiet = profile.nutrition.diet === null;
  const [ml, setMl] = useState<number | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);

  useEffect(() => {
    let live = true;
    repo.getKv<boolean>(WATER_SETUP_DISMISSED_KEY).then((d) => live && setDismissed(Boolean(d)));
    return () => {
      live = false;
    };
  }, [repo]);

  if (dismissed !== false || (!askWater && !askDiet)) return null;
  const range = stepperRange(false);
  const shownMl = ml ?? suggestion.ml;

  const save = async () => {
    await updateProfile({
      ...(askWater ? { water: { targetMl: shownMl } } : null),
      ...(askDiet && diet ? { nutrition: { diet } } : null),
    });
    await repo.setKv(WATER_SETUP_DISMISSED_KEY, true);
    setDismissed(true);
  };
  const notNow = async () => {
    await repo.setKv(WATER_SETUP_DISMISSED_KEY, true);
    setDismissed(true);
  };

  return (
    <Card title="Two quick questions" level={3}>
      {askWater ? (
        <>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            Water a day
          </ThemedText>
          <Stepper
            value={shownMl}
            onChange={setMl}
            step={range.step}
            min={range.min}
            max={range.max}
            format={(v) => formatLitres(v, units)}
          />
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
            {suggestion.basis}
          </ThemedText>
        </>
      ) : null}
      {askDiet ? (
        <>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            What do you eat?
          </ThemedText>
          <DietChips value={diet} onChange={setDiet} />
        </>
      ) : null}
      <View style={styles.buttons}>
        <Button label="Not now" variant="text" compact onPress={notNow} />
        <Button label="Save" variant="tonal" compact onPress={save} disabled={askDiet && !askWater && !diet} />
      </View>
    </Card>
  );
}

export const hourLabel = (h: number): string => {
  const suffix = h < 12 || h === 24 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
};

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: TouchTarget },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  grow: { flex: 1 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  list: { overflow: 'hidden', paddingVertical: Spacing.one },
});
