import { BuddiesHome } from '@/components/buddies/buddies-home';
import { Sub } from '@/components/plain/plain-kit';
import { PlainPage } from '@/components/plain/plain-page';
import { PremiumCard } from '@/components/premium-gate';
import { SCREEN_FEATURES } from '@/premium/premium';
import { usePremium } from '@/state/use-premium';

/** Buddies: Walk buddies (chats, buddies, requests); clubs, plans and QR come next. Locked: the premium card, under the top row. */
export default function PlusTab() {
  const premium = usePremium();
  if (premium.isLocked(SCREEN_FEATURES.buddies)) {
    return (
      <PlainPage>
        <Sub lead="Walk buddies" />
        <PremiumCard />
      </PlainPage>
    );
  }
  return <BuddiesHome />;
}
