import { useState } from 'react';

import { Segmented } from '@/components/controls';
import { HistoryView } from '@/components/history-view';
import { Patterns } from '@/components/patterns';
import { PremiumGate } from '@/components/premium-gate';
import { Screen } from '@/components/screen';
import { SCREEN_FEATURES } from '@/premium/premium';

type View = 'patterns' | 'history';

export default function InsightsTab() {
  return (
    <PremiumGate feature={SCREEN_FEATURES.insights} title="Insights">
      <InsightsScreen />
    </PremiumGate>
  );
}

function InsightsScreen() {
  const [view, setView] = useState<View>('patterns');
  return (
    <Screen title="Insights">
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
