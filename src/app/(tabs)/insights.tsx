import { useState } from 'react';

import { Segmented } from '@/components/controls';
import { HistoryView } from '@/components/history-view';
import { Patterns } from '@/components/patterns';
import { Screen } from '@/components/screen';

type View = 'patterns' | 'history';

export default function InsightsScreen() {
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
