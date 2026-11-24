import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { AnswerCounts, PeopleList } from '@/components/buddies/plans/plan-parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Dialog, IconButton, ListRow, Pill, Screen, Sheet, Snackbar, Surface } from '@/components/ui';
import { ANSWER_WORD, inviteeGroups, isOrganiser, planCounts, planWhen, reminderAt } from '@/buddies/plans';
import { buddyChatKey, displayName } from '@/buddies/read';
import type { PlanInvitee } from '@/buddies/types';
import { usePlan } from '@/buddies/use-plans';
import { Spacing } from '@/constants/theme';
import { useClock } from '@/hooks/use-clock';
import { useClockStyle } from '@/hooks/use-clock-style';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * A planned walk (T16e). The organiser sees how many are going, can't make
 * it or haven't said, the lists, and Change and Cancel walk in the menu.
 * Someone invited answers Going or Can't make it; Going sets a reminder on
 * the phone 1 hour before. A club plan opens the club chat.
 */
export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = usePlan(id);
  const now = useClock().now;
  const clock = useClockStyle();
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<'going' | 'not_going' | 'cancel' | null>(null);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const plan = p.plan;
  const title = 'Planned walk';

  const chat = (w: PlanInvitee['walker']) =>
    router.push({ pathname: '/buddies/chat/[key]', params: { key: buddyChatKey(w.pid), title: displayName(w) } } as never);

  if (!plan) {
    return (
      <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
        <Screen title={title} onBack={back} onRefresh={p.refresh}>
          {p.error ? (
            <>
              <ThemedText themeColor="onSurfaceVariant">{p.error}</ThemedText>
              <Button label="Try again" variant="text" compact onPress={p.refresh} style={styles.start} />
            </>
          ) : (
            <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
          )}
        </Screen>
      </PremiumGate>
    );
  }

  const mine = isOrganiser(plan);
  const club = plan.club;
  const on = plan.status === 'on';
  const groups = inviteeGroups(p.invitees.filter((i) => i.walker.relation !== 'self' || !mine));
  const counts = planCounts(plan, p.invitees);
  const when = planWhen(plan.startsAt, now, clock);
  const by = mine ? 'You planned this walk.' : `Planned by ${displayName(plan.organiser)}${plan.organiser.name ? ` (@${plan.organiser.handle})` : ''}.`;

  const answer = async (a: 'going' | 'not_going') => {
    setBusy(a);
    const r = await p.answer(a);
    setBusy(null);
    if (r.err) return show(r.err);
    show(a === 'going' ? (r.reminded ? "You're going. We'll remind you 1 hour before." : "You're going.") : `${displayName(plan.organiser)} will see you can't make it.`);
  };

  const cancel = async () => {
    setAsking(false);
    setBusy('cancel');
    const err = await p.cancel();
    setBusy(null);
    show(err ?? 'Walk cancelled. Everyone invited is told.');
  };

  const cells = [
    { n: counts.going, word: ANSWER_WORD.going },
    { n: counts.notGoing, word: ANSWER_WORD.not_going },
    ...(counts.waiting !== null ? [{ n: counts.waiting, word: ANSWER_WORD.none }] : []),
  ];

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title={title} onBack={back}>
      <Screen
        title={title}
        onBack={back}
        onRefresh={p.refresh}
        right={mine && on ? <IconButton icon="ellipsis-vertical" accessibilityLabel="Walk menu" onPress={() => setMenu(true)} /> : undefined}
        overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {/* The walk's heading lines are one group: Screen's block gap applies once, not between each line. */}
        <View>
          {!on ? (
            <View style={styles.start}>
              <Pill label="Cancelled" variant="tint" />
            </View>
          ) : null}
          <ThemedText type="titleLarge" style={!on ? styles.gapSmall : undefined} maxFontSizeMultiplier={1.3}>
            {plan.place}
          </ThemedText>
          <ThemedText themeColor="onSurfaceVariant" style={styles.gapTiny} maxFontSizeMultiplier={1.3}>
            {plan.club ? `${when} · ${plan.club.name}` : when}
          </ThemedText>
          {plan.note ? (
            <ThemedText style={styles.gapSmall} maxFontSizeMultiplier={1.3}>
              {plan.note}
            </ThemedText>
          ) : null}
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gapSmall} maxFontSizeMultiplier={1.3}>
            {by}
          </ThemedText>
        </View>

        <View style={styles.gap}>
          <AnswerCounts cells={cells} />
        </View>

        {!mine && on ? (
          <View style={styles.gap}>
            <View style={styles.answers}>
              <Button
                label={ANSWER_WORD.going}
                variant={plan.myAnswer === 'going' ? 'filled' : 'outlined'}
                icon={plan.myAnswer === 'going' ? 'checkmark' : undefined}
                onPress={() => answer('going')}
                loading={busy === 'going'}
                disabled={!!busy}
                accessibilityLabel={plan.myAnswer === 'going' ? 'Going, chosen' : 'Going'}
              />
              <Button
                label={ANSWER_WORD.not_going}
                variant={plan.myAnswer === 'not_going' ? 'filled' : 'outlined'}
                icon={plan.myAnswer === 'not_going' ? 'checkmark' : undefined}
                onPress={() => answer('not_going')}
                loading={busy === 'not_going'}
                disabled={!!busy}
                accessibilityLabel={plan.myAnswer === 'not_going' ? "Can't make it, chosen" : "Can't make it"}
              />
            </View>
            <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gapSmall} maxFontSizeMultiplier={1.3}>
              {plan.myAnswer === 'going'
                ? p.reminded
                  ? "We'll remind you 1 hour before."
                  : reminderAt(plan, now)
                    ? 'Turn on notifications for Steps to get a reminder 1 hour before.'
                    : "You're going."
                : 'Going sets a reminder on this phone 1 hour before.'}
            </ThemedText>
          </View>
        ) : null}
        {mine && on && p.reminded ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gapSmall} maxFontSizeMultiplier={1.3}>
            {"We'll remind you 1 hour before."}
          </ThemedText>
        ) : null}

        {plan.club || (!mine && plan.organiser.relation === 'buddy') ? (
          <Surface level={1} style={[styles.list, styles.gap]}>
            {club ? (
              <ListRow
                title="Club chat"
                supporting={club.name}
                icon="chatbubbles-outline"
                chevron
                onPress={() => router.push({ pathname: '/buddies/club/[id]', params: { id: club.clubId, seg: 'chat' } } as never)}
                last={mine || plan.organiser.relation !== 'buddy'}
              />
            ) : null}
            {!mine && plan.organiser.relation === 'buddy' ? (
              <ListRow title={`Message ${displayName(plan.organiser)}`} icon="chatbubble-outline" chevron onPress={() => chat(plan.organiser)} last />
            ) : null}
          </Surface>
        ) : null}

        {mine || plan.club ? (
          <>
            <PeopleList title={ANSWER_WORD.going} people={groups.going} onOpen={(i) => chat(i.walker)} />
            <PeopleList title={ANSWER_WORD.not_going} people={groups.not_going} onOpen={(i) => chat(i.walker)} />
            {!plan.club ? <PeopleList title={ANSWER_WORD.none} people={groups.none} onOpen={(i) => chat(i.walker)} /> : null}
          </>
        ) : null}
        {mine && plan.club && !groups.going.length && !groups.not_going.length ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gap} maxFontSizeMultiplier={1.3}>
            Everyone in the club can see this walk. People who answer are listed here.
          </ThemedText>
        ) : null}
      </Screen>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={plan.place}>
        <ListRow
          title="Change"
          supporting="Time, place, note or who's invited"
          icon="create-outline"
          chevron
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/buddies/plan/new', params: { id: plan.planId } } as never);
          }}
        />
        <ListRow title="Cancel walk" icon="close-circle-outline" onPress={() => (setMenu(false), setAsking(true))} last />
      </Sheet>

      <Dialog
        visible={asking}
        title="Cancel this walk?"
        message="Everyone invited is told. This can't be undone."
        confirmLabel="Cancel walk"
        cancelLabel="Keep it"
        danger
        onCancel={() => setAsking(false)}
        onConfirm={cancel}
      />
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  gap: { marginTop: Spacing.four },
  gapSmall: { marginTop: Spacing.two },
  gapTiny: { marginTop: Spacing.one },
  // One under the other: both labels fit at 360 dp and the largest font.
  answers: { gap: Spacing.two },
  list: { overflow: 'hidden' },
});
