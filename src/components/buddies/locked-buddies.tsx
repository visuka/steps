/**
 * Buddies while it is locked (no Premium): the premium card under the top row,
 * then Your clubs, so a member can still leave a club or stop goal tracking.
 * ?ask=leave&id=<clubId> opens that club's Leave dialog (the design preview's captain shot).
 */
import { useLocalSearchParams } from 'expo-router';

import { Snackbar } from '@/components/ui';
import { Sub } from '@/components/plain/plain-kit';
import { PlainPage } from '@/components/plain/plain-page';
import { PremiumCard } from '@/components/premium-gate';

import { LockedClubs } from './clubs/locked-clubs';
import { useSnack } from './parts';

export function LockedBuddies() {
  const { snack, show, dismiss } = useSnack();
  const { ask, id } = useLocalSearchParams<{ ask?: string; id?: string }>();
  return (
    <PlainPage overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      <Sub lead="Walk buddies" />
      <PremiumCard />
      <LockedClubs show={show} askLeave={ask === 'leave' && typeof id === 'string' ? id : undefined} />
    </PlainPage>
  );
}
