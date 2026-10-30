import { useState } from 'react';

import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { useVitalsConnection } from '@/state/use-vitals';

/** Offers to read sleep, heart rate and BP from the health store; hidden once connected or where there's none. */
export function ConnectHealth({ what }: { what: string }) {
  const vitals = useVitalsConnection();
  const [refused, setRefused] = useState(false);
  if (vitals.loading || vitals.connected || !vitals.available || !vitals.label) return null;

  return (
    <Card title="From your watch">
      <ThemedText>
        Wear a watch or band? If its app saves to {vitals.label}, Steps can read your {what} from there. Nothing leaves
        your phone.
      </ThemedText>
      <Button label={`Connect ${vitals.label}`} onPress={async () => setRefused(!(await vitals.connect()))} />
      {refused ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing was allowed. You can change this later in {vitals.label}&apos;s app permissions.
        </ThemedText>
      ) : null}
    </Card>
  );
}
