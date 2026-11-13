import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Segmented } from '@/components/controls';
import { HistoryView } from '@/components/history-view';
import { Patterns } from '@/components/patterns';
import { PremiumGate } from '@/components/premium-gate';
import { Screen } from '@/components/screen';
import { SCREEN_FEATURES } from '@/premium/premium';

type View = 'patterns' | 'history';

/** Insights, opened from You (and from links); pushed over the tabs, so Back returns there. */
export default function InsightsRoute() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));
  return (
    <PremiumGate feature={SCREEN_FEATURES.insights} title="Insights" onBack={back}>
      <InsightsScreen onBack={back} />
    </PremiumGate>
  );
}

function InsightsScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('patterns');
  return (
    <Screen title="Insights" onBack={onBack}>
      <Segmented
        options={[
          { value: 'patterns', label: 'Patterns' },
          { value: 'history', label: 'History' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'patterns' ? <Patterns /> : <HistoryView />}
    </Screen>
  );
}
