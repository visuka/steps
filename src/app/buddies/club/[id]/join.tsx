import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { GoalsConsent } from '@/components/buddies/clubs/club-parts';
import { useSnack } from '@/components/buddies/parts';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Screen, Snackbar } from '@/components/ui';
import { useClub } from '@/buddies/use-clubs';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Before joining a club with shared goals: what the captain and vice-captains
 * see, what they never see, Join and Not now. Only Join sends anything, with
 * goalsConsent: true.
 */
export default function ClubJoinScreen() {
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
          <ThemedText themeColor="error">{c.error}</ThemedText>
        ) : (
          <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
        )}
      </Screen>
    </PremiumGate>
  );
}
