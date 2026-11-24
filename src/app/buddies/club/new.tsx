import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Screen, Snackbar, Surface, ToggleRow } from '@/components/ui';
import { ABOUT_MAX, AREA_MAX, clubProblem, NAME_MAX } from '@/buddies/clubs';
import type { Club, ClubForm } from '@/buddies/types';
import { useClubForm } from '@/buddies/use-clubs';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

const formOf = (c: Club): ClubForm => ({ name: c.name, area: c.area, about: c.about, hidden: c.hidden, goals: c.goals });

/** Start a club, or (with ?id=) edit one: name, area, about, Hide from search and Shared goals. */
export default function ClubFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const f = useClubForm(id || undefined);
  const editing = !!id;
  const title = editing ? 'Edit club' : 'Start a club';
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
      {editing && !f.existing ? (
        <Screen title={title} onBack={back}>
          <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
        </Screen>
      ) : (
        // Keyed by the club, so the fields start from it once it has loaded.
        <Form key={f.existing?.clubId ?? 'new'} id={id || undefined} title={title} before={f.existing ? formOf(f.existing) : undefined} save={f.save} back={back} />
      )}
    </PremiumGate>
  );
}

function Form({
  id,
  title,
  before,
  save,
  back,
}: {
  id?: string;
  title: string;
  before?: ClubForm;
  save: (f: ClubForm, before?: ClubForm) => Promise<{ clubId: string | null; err: string | null }>;
  back: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClubForm>(before ?? { name: '', area: '', about: '', hidden: false, goals: false });
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const set = <K extends keyof ClubForm>(k: K) => (v: ClubForm[K]) => setForm((x) => ({ ...x, [k]: v }));
  const problem = form.name.trim() ? clubProblem(form) : null;
  const ready = !!form.name.trim() && !problem && !busy;

  const submit = async () => {
    setBusy(true);
    const r = await save(form, before);
    setBusy(false);
    if (r.err || !r.clubId) return show(r.err ?? 'Something went wrong. Try again.');
    if (id) return back();
    router.replace({ pathname: '/buddies/club/[id]', params: { id: r.clubId } } as never);
  };

  return (
    <Screen title={title} onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      {/* Screen spaces its blocks 16 apart; each field shows its label above it. */}
      <TextField label="Club name" value={form.name} onChangeText={set('name')} placeholder="e.g. KBR Morning Walkers" maxLength={NAME_MAX} showLabel />
      {problem ? (
        <ThemedText type="bodySmall" themeColor="error" maxFontSizeMultiplier={1.3}>
          {problem}
        </ThemedText>
      ) : null}
      <View>
        <TextField label="Area (optional)" value={form.area} onChangeText={set('area')} placeholder="e.g. Banjara Hills" maxLength={AREA_MAX} showLabel />
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3} style={styles.helper}>
          A place name people know. Never your address.
        </ThemedText>
      </View>
      <TextField label="About (optional)" value={form.about} onChangeText={set('about')} placeholder="When and where you walk" maxLength={ABOUT_MAX} multiline showLabel />
      <Surface level={1} style={styles.list}>
        {/* Each note sits under its own switch's title, so it is clear which switch it explains. */}
        <ToggleRow title="Hide from search" supporting="Only people you invite can find it." value={form.hidden} onValueChange={set('hidden')} />
        <ToggleRow
          title="Shared goals"
          supporting={"You can set goals for members, like steps or medicines. Members see what you'll see before they join."}
          value={form.goals}
          onValueChange={set('goals')}
        />
      </Surface>
      <Button label={id ? 'Save' : 'Start club'} onPress={submit} loading={busy} disabled={!ready} />
      {!id ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {"You'll be the captain. You can make up to 2 members vice-captains."}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  // On the field's typed-text edge, just under the box.
  helper: { marginTop: Spacing.one, marginLeft: Spacing.three },
});
