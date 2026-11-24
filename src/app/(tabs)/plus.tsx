import { BuddiesHome } from '@/components/buddies/buddies-home';
import { LockedBuddies } from '@/components/buddies/locked-buddies';
import { SCREEN_FEATURES } from '@/premium/premium';
import { usePremium } from '@/state/use-premium';

/**
 * Buddies: Walk buddies (chats, buddies, requests, clubs, planned walks, QR, My goals).
 * Locked: the premium card, under the top row, and Your clubs (Leave club, Stop goal tracking).
 */
export default function PlusTab() {
  const premium = usePremium();
  if (premium.isLocked(SCREEN_FEATURES.buddies)) return <LockedBuddies />;
  return <BuddiesHome />;
}
