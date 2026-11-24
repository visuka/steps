import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { openPicker } from '@/components/buddies/plans/open-picker';
import { SafetySheet } from '@/components/buddies/plans/safety-sheet';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ListRow, MaterialSwitch, Screen, Snackbar, Surface } from '@/components/ui';
import {
  atDayTime,
  dayChoices,
  defaultStart,
  INVITE_MAX,
  lastDay,
  minutesOf,
  NOTE_MAX,
  PLACE_MAX,
  planProblem,
} from '@/buddies/plans';
import { displayName } from '@/buddies/read';
import type { BuddyRow, ClubCard, PlanForm } from '@/buddies/types';
import { type PlanBefore, usePlanForm, useSafetyTips } from '@/buddies/use-plans';
import { Spacing } from '@/constants/theme';
import { useClock } from '@/hooks/use-clock';
import { useClockStyle } from '@/hooks/use-clock-style';
import { dayKey, formatDayLong, parseDayKey } from '@/lib/dates';
import { atClock, formatClock } from '@/lib/when';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Plan a walk (T16e), or (with ?id=) change one: the day and time, a place
 * name (never a map pin), a note, and who: 1–20 buddies or one of my clubs
 * (?club= picks it). The safety tips show once before the first plan.
 */
export default function PlanFormScreen() {
  const { id, club } = useLocalSearchParams<{ id?: string; club?: string }>();
  const f = usePlanForm(id || undefined);
  const editing = !!id;
  const title = editing ? 'Change walk' : club ? 'Plan a club walk' : 'Plan a walk';
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
      {(editing && !f.before) || f.loading ? (
        <Screen title={title} onBack={back}>
          <ThemedText themeColor={f.error ? 'error' : 'onSurfaceVariant'}>{f.error ?? '—'}</ThemedText>
        </Screen>
      ) : (
        // Keyed by the plan, so the fields start from it once it has loaded.
        <Form
          key={id ?? 'new'}
          id={id || undefined}
          title={title}
          before={f.before}
          presetClub={club || null}
          buddies={f.buddies}
          clubs={f.clubs}
          save={f.save}
          back={back}
        />
      )}
    </PremiumGate>
  );
}

function Form({
  id,
  title,
  before,
  presetClub,
  buddies,
  clubs,
  save,
  back,
}: {
  id?: string;
  title: string;
  before: PlanBefore | null;
  presetClub: string | null;
  buddies: BuddyRow[];
  clubs: ClubCard[];
  save: ReturnType<typeof usePlanForm>['save'];
  back: () => void;
}) {
  const router = useRouter();
  const now = useClock().now;
  const clock = useClockStyle();
  const editing = !!id;
  const tips = useSafetyTips('plan', !editing);
  const [form, setForm] = useState<PlanForm>(() => ({
    startsAt: before?.startsAt ?? defaultStart(now),
    place: before?.place ?? '',
    note: before?.note ?? '',
    invite: before?.invite ?? [],
    clubId: before?.clubId ?? (presetClub && clubs.some((c) => c.clubId === presetClub) ? presetClub : null),
  }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const set = <K extends keyof PlanForm>(k: K) => (v: PlanForm[K]) => setForm((x) => ({ ...x, [k]: v }));

  const day = dayKey(new Date(form.startsAt));
  const minutes = minutesOf(form.startsAt);
  const days = dayChoices(now);
  const otherDay = !days.some((d) => d.day === day);
  const locked = new Set(before?.invite ?? []);
  const picked = new Set(form.invite);
  const club = clubs.find((c) => c.clubId === form.clubId) ?? null;
  const problem = tried ? planProblem(form, now, { editing }) : null;

  const pickDay = (d: string) => setForm((x) => ({ ...x, startsAt: atDayTime(d, minutes) }));
  const pickOtherDay = () =>
    openPicker?.({
      value: parseDayKey(day),
      mode: 'date',
      minimumDate: parseDayKey(dayKey(new Date(now))),
      maximumDate: parseDayKey(lastDay(now)),
      onValueChange: (_e, d) => pickDay(dayKey(d)),
    });
  const pickTime = () =>
    openPicker?.({
      value: new Date(form.startsAt),
      mode: 'time',
      onValueChange: (_e, t) => setForm((x) => ({ ...x, startsAt: atClock(x.startsAt, t) })),
    });
  const toggle = (pid: string, on: boolean) =>
    setForm((x) => ({ ...x, invite: on ? [...new Set([...x.invite, pid])] : x.invite.filter((p) => p !== pid) }));

  const submit = async () => {
    setTried(true);
    if (planProblem(form, now, { editing })) return;
    setBusy(true);
    const r = await save(form, before, Date.now());
    setBusy(false);
    if (r.err || !r.planId) return show(r.err ?? 'Something went wrong. Try again.');
    if (editing) return back();
    router.replace({ pathname: '/buddies/plan/[id]', params: { id: r.planId } } as never);
  };

  return (
    <Screen
      title={title}
      onBack={back}
      overlay={
        <>
          <Snackbar message={snack} onDismiss={dismiss} />
          <SafetySheet visible={tips.open} onClose={tips.close} />
        </>
      }>
      {/* Each part is one block: its label 8 above its content; Screen keeps 16 between blocks. */}
      <View style={styles.section}>
        <Heading text="Day" />
        <View style={styles.chips}>
          {days.map((d) => (
            <Chip key={d.day} label={d.label} selected={d.day === day} onPress={() => pickDay(d.day)} />
          ))}
          {openPicker ? (
            <Chip
              label={otherDay ? formatDayLong(day) : 'Other day'}
              selected={otherDay}
              trailingIcon="chevron-down"
              onPress={pickOtherDay}
              accessibilityLabel={otherDay ? `Day: ${formatDayLong(day)}. Change` : 'Pick another day'}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Heading text="Time" />
        <View style={styles.chips}>
          <Chip
            label={formatClock(form.startsAt, clock)}
            selected
            trailingIcon="chevron-down"
            onPress={pickTime}
            disabled={!openPicker}
            accessibilityLabel={`Time: ${formatClock(form.startsAt, clock)}. Change`}
          />
        </View>
      </View>

      <View style={styles.section}>
        <TextField label="Where you'll meet" value={form.place} onChangeText={set('place')} placeholder="e.g. KBR Park main gate" maxLength={PLACE_MAX} />
        <Caption text="Type a place name. No map pin is shared." />
      </View>
      <View style={styles.section}>
        <TextField label="Note (optional)" value={form.note} onChangeText={set('note')} placeholder="Pace, how long, what to bring" maxLength={NOTE_MAX} multiline />
      </View>

      <View style={styles.section}>
        <Heading text="Who" />
        {editing ? (
          <Caption text={club ? `Everyone in ${club.name} can see it.` : 'Add buddies below. Everyone invited is told about changes.'} />
        ) : (
          <View style={styles.chips}>
            <Chip label="Buddies" selected={!form.clubId} onPress={() => set('clubId')(null)} />
            {clubs.map((c) => (
              <Chip key={c.clubId} label={c.name} selected={form.clubId === c.clubId} onPress={() => set('clubId')(c.clubId)} />
            ))}
          </View>
        )}
        {form.clubId ? (
          !editing ? <Caption text={`Everyone in ${club?.name ?? 'the club'} can see it and say if they're going.`} /> : null
        ) : buddies.length ? (
          <>
            <Caption text={`Up to ${INVITE_MAX}. ${picked.size} picked.`} />
            <Surface level={1} style={styles.list}>
              {buddies.map((b, i) => {
                const name = displayName(b.walker);
                const isLocked = locked.has(b.walker.pid);
                const on = picked.has(b.walker.pid);
                return (
                  <ListRow
                    key={b.walker.pid}
                    title={name}
                    supporting={isLocked ? 'Invited' : b.walker.name ? `@${b.walker.handle}` : undefined}
                    onPress={isLocked ? undefined : () => toggle(b.walker.pid, !on)}
                    trailing={
                      <MaterialSwitch
                        value={on}
                        onValueChange={(v) => toggle(b.walker.pid, v)}
                        disabled={isLocked}
                        accessibilityLabel={`Invite ${name}`}
                      />
                    }
                    last={i === buddies.length - 1}
                  />
                );
              })}
            </Surface>
          </>
        ) : (
          <Caption text={clubs.length ? 'Add buddies first, or pick a club.' : 'Add buddies first. Find them by their walker ID.'} />
        )}
      </View>

      {problem ? (
        <ThemedText type="bodySmall" themeColor="error" style={styles.gap} maxFontSizeMultiplier={1.3}>
          {problem}
        </ThemedText>
      ) : null}
      <Button
        label={editing ? 'Save changes' : form.clubId ? 'Plan walk' : 'Send invites'}
        onPress={submit}
        loading={busy}
        disabled={busy}
        style={styles.gap}
      />
      <Caption text={editing ? 'Everyone invited is told.' : 'Steps never shares where you are, only the place you type.'} />
    </Screen>
  );
}

function Heading({ text }: { text: string }) {
  return (
    <ThemedText type="titleSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
      {text}
    </ThemedText>
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
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gap: { marginTop: Spacing.three },
  list: { overflow: 'hidden' },
});
