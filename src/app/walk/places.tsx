import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { confirm } from '@/components/confirm';
import { Segmented, TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Chip,
  EmptyState,
  ExtendedFab,
  type IconName,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  Snackbar,
  Surface,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { canPin, DEFAULT_RADIUS_M, type Fix, type Place, PLACE_NAMES, PLACE_RADII } from '@/lib/places';
import { preciseLocationAllowed, requestLocation } from '@/location/place';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { freshFix } from '@/walks/fix';
import { newPlace } from '@/walks/places';
import { accuracyText } from '@/walks/view';

const ICON: Record<string, IconName> = {
  Home: 'home-outline',
  Office: 'briefcase-outline',
  Gym: 'barbell-outline',
  "Friend's home": 'people-outline',
};

const PLACES_WHY =
  'At a pinned place a walk counts your steps with no GPS, which saves battery indoors. When you leave, it starts mapping your route. Pins are kept in the app’s data, which Android may include in your Google backup.';

type Problem = 'denied' | 'coarse' | 'nofix' | 'rough';

const PROBLEM_TEXT: Record<Problem, string> = {
  denied: 'Location is off for this app',
  coarse: 'Precise location is off',
  nofix: 'Couldn’t find where you are',
  rough: 'Location is too rough to pin',
};

type Editing = { kind: 'new'; fix: Fix } | { kind: 'edit'; place: Place };

/** Pinned places: Home, Office, Gym… where walks can count steps without GPS. */
export default function PlacesRoute() {
  const router = useRouter();
  return (
    <PremiumGate feature={SCREEN_FEATURES['walk/places']} title="Places" onBack={() => router.back()}>
      <PlacesScreen />
    </PremiumGate>
  );
}

function PlacesScreen() {
  const { repo } = useApp();
  const router = useRouter();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<{ kind: Problem; acc?: number | null } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_M);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    repo.getPlaces().then(
      (list) => live && setPlaces(list),
      () => live && setPlaces([]),
    );
    return () => {
      live = false;
    };
  }, [repo, version]);

  const freeName = (list: Place[]) => PLACE_NAMES.find((n) => !list.some((p) => p.name === n)) ?? '';

  const pinHere = async () => {
    setProblem(null);
    setLocating(true);
    try {
      if (!(await requestLocation())) return setProblem({ kind: 'denied' });
      if (!(await preciseLocationAllowed())) return setProblem({ kind: 'coarse' });
      const fix = await freshFix();
      if (!fix) return setProblem({ kind: 'nofix' });
      if (!canPin(fix, true)) return setProblem({ kind: 'rough', acc: fix.acc });
      setName(freeName(places ?? []));
      setRadius(DEFAULT_RADIUS_M);
      setEditing({ kind: 'new', fix });
    } finally {
      setLocating(false);
    }
  };

  const edit = (place: Place) => {
    setName(place.name);
    setRadius(place.radiusM);
    setEditing({ kind: 'edit', place });
  };

  const save = async () => {
    if (!editing) return;
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    setSaving(true);
    try {
      if (editing.kind === 'new') {
        const place = newPlace(clean, editing.fix, true, radius);
        if (!place) return;
        await repo.savePlace(place);
        setMessage(`${place.name} pinned`);
      } else {
        await repo.savePlace({ ...editing.place, name: clean, radiusM: radius, updatedAt: Date.now() });
        setMessage('Saved');
      }
      setEditing(null);
      load();
    } catch {
      setMessage('Couldn’t save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (place: Place) =>
    confirm(
      `Remove ${place.name}?`,
      'Past walks stay.',
      async () => {
        setEditing(null);
        await repo.deletePlace(place.id);
        load();
        setMessage(`${place.name} removed`);
      },
      'Remove',
    );

  const sheetTitle = editing?.kind === 'new' ? 'Pin this place' : 'Edit place';
  const dismiss = useCallback(() => setMessage(null), []);

  return (
    <Screen
      title="Places"
      onBack={() => router.back()}
      fab={<ExtendedFab label={locating ? 'Finding you…' : 'Pin where I am'} icon="pin" onPress={locating ? () => undefined : pinHere} />}
      overlay={<Snackbar message={message} onDismiss={dismiss} />}>
      <SectionHeader title="Where you walk indoors" why={PLACES_WHY} />

      {problem ? (
        <Surface level={3} style={styles.problem}>
          <ThemedText type="titleSmall">
            {PROBLEM_TEXT[problem.kind]}
            {problem.kind === 'rough' ? ` (${accuracyText(problem.acc)})` : ''}
          </ThemedText>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            {problem.kind === 'denied' || problem.kind === 'coarse'
              ? 'Turn on precise location for this app.'
              : 'Go near a window or outside, then try again.'}
          </ThemedText>
          {problem.kind === 'denied' || problem.kind === 'coarse' ? (
            <Button label="Open settings" variant="tonal" compact onPress={() => Linking.openSettings()} />
          ) : (
            <Button label="Try again" variant="tonal" compact onPress={pinHere} />
          )}
        </Surface>
      ) : null}

      {places && places.length === 0 ? (
        <EmptyState icon="location-outline" title="No places yet" hint="Pin home or the gym to walk there without GPS." />
      ) : places ? (
        <Surface level={1} style={styles.list}>
          {places.map((p) => (
            <ListRow
              key={p.id}
              icon={ICON[p.name] ?? 'location-outline'}
              title={p.name}
              supporting={`Within ${p.radiusM} m`}
              chevron
              onPress={() => edit(p)}
              accessibilityHint="Rename, resize or remove"
            />
          ))}
        </Surface>
      ) : null}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={sheetTitle}>
        {editing?.kind === 'new' ? (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            Where you are now · {accuracyText(editing.fix.acc)}
          </ThemedText>
        ) : null}
        <ThemedText type="labelLarge">Name</ThemedText>
        <View style={styles.chips}>
          {PLACE_NAMES.map((n) => (
            <Chip key={n} label={n} accessibilityLabel={n} selected={name === n} onPress={() => setName(n)} />
          ))}
        </View>
        <TextField value={name} onChangeText={setName} label="Name" placeholder="Or type a name" maxLength={40} />
        <ThemedText type="labelLarge">Size</ThemedText>
        <Segmented
          options={PLACE_RADII.map((r) => ({ value: String(r), label: `${r} m` }))}
          value={String(radius)}
          onChange={(v) => setRadius(Number(v))}
        />
        <Button label="Save" onPress={save} loading={saving} disabled={!name.trim()} />
        {editing?.kind === 'edit' ? (
          <Button label={`Remove ${editing.place.name}`} variant="text" danger onPress={() => remove(editing.place)} />
        ) : (
          <Button label="Cancel" variant="text" onPress={() => setEditing(null)} />
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden', paddingVertical: Spacing.one },
  problem: { padding: Spacing.three, gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
