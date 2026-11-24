/**
 * Buddies while it is locked (no Premium): the premium card under the top row,
 * then Your clubs, so a member can still leave a club or stop goal tracking.
 */
import { Snackbar } from '@/components/ui';
import { Sub } from '@/components/plain/plain-kit';
import { PlainPage } from '@/components/plain/plain-page';
import { PremiumCard } from '@/components/premium-gate';

import { LockedClubs } from './clubs/locked-clubs';
import { useSnack } from './parts';

export function LockedBuddies() {
  const { snack, show, dismiss } = useSnack();
  return (
    <PlainPage overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
      <Sub lead="Walk buddies" />
      <PremiumCard />
      <LockedClubs show={show} />
    </PlainPage>
  );
}
