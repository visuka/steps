import { Stack, useRouter } from 'expo-router';

import { ScanScreen } from '@/components/food/scan-screen';
import { PremiumGate } from '@/components/premium-gate';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Food → Scan, over the tabs: a barcode or QR code on a food pack → the
 * product → Add to today (stepsinfra docs/barcode-scan.md). Premium, like the
 * rest of Food; free accounts see the Premium card before any camera question.
 */
export default function FoodScanRoute() {
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/food'));
  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', headerShown: false }} />
      <PremiumGate feature={SCREEN_FEATURES['journal/food']} title="Scan a pack" onBack={close}>
        <ScanScreen onClose={close} />
      </PremiumGate>
    </>
  );
}
