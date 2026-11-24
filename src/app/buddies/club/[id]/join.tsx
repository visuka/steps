import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { GoalsConsent } from '@/components/buddies/clubs/club-parts';
import { useSnack } from '@/components/buddies/parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Screen, Snackbar } from '@/components/ui';
import { useClub } from '@/buddies/use-clubs';
import { useClubByCode } from '@/buddies/use-qr';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Before joining a club with shared goals: what the captain and vice-captains
 * see, what they never see, Join and Not now. Only Join sends anything, with
 * goalsConsent: true. With `code` (from a club QR or link) the club is read
 * by its code, so a hidden club works too, and the code goes with the ask.
 */
export default function ClubJoinScreen() {
  const { code } = useLocalSearchParams<{ id: string; code?: string }>();
  return code ? <JoinWithCode code={code} /> : <JoinById />;
}

function JoinById() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useClub(id);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const join = async () => {
    setBusy(true);
    const r = await c.join({ consent: true });
    setBusy(false);
    if (r.err) return show(r.err);
    show(r.state === 'member' ? `You're in ${c.club?.name ?? 'the club'}.` : 'Asked. The captain or a vice-captain will let you in.');
    setTimeout(back, 900);
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Shared goals" onBack={back}>
      <Screen title="Shared goals" onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {c.club ? (
          <GoalsConsent club={c.club} busy={busy} onJoin={join} onNotNow={back} />
        ) : c.error ? (
          <ThemedText themeColor="onSurfaceVariant">{c.error}</ThemedText>
        ) : (
          <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
        )}
      </Screen>
    </PremiumGate>
  );
}

function JoinWithCode({ code }: { code: string }) {
  const router = useRouter();
  const c = useClubByCode(code);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const join = async () => {
    setBusy(true);
    const r = await c.join(true);
    setBusy(false);
    if (r.err) return show(r.err);
    show(r.state === 'member' ? `You're in ${c.card?.name ?? 'the club'}.` : 'Asked. The captain or a vice-captain will let you in.');
    setTimeout(back, 900);
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Shared goals" onBack={back}>
      <Screen title="Shared goals" onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {c.card ? (
          <GoalsConsent club={c.card} busy={busy} onJoin={join} onNotNow={back} />
        ) : c.error ? (
          <ThemedText themeColor="onSurfaceVariant">{c.error}</ThemedText>
        ) : (
          <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
        )}
      </Screen>
    </PremiumGate>
  );
}
