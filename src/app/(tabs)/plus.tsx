import { BuddiesHome } from '@/components/buddies/buddies-home';
import { PremiumGate } from '@/components/premium-gate';
import { SCREEN_FEATURES } from '@/premium/premium';

/** The bar's plus: Walk buddies (chats, buddies, requests); clubs, plans and QR come next. */
export default function PlusTab() {
  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Chats and buddies">
      <BuddiesHome />
    </PremiumGate>
  );
}
