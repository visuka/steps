import { useEffect, useState } from 'react';

import { type ConfirmRequest, setConfirmPresenter } from '@/components/confirm';
import { Dialog } from '@/components/ui/dialog';

/**
 * Shows every confirm() in the app's own Material dialog, in the park-track
 * colours, instead of the system alert. Mounted once, in app/_layout.tsx.
 */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    setConfirmPresenter(setRequest);
    return () => setConfirmPresenter(null);
  }, []);

  return (
    <Dialog
      visible={request !== null}
      title={request?.title ?? ''}
      message={request?.message}
      confirmLabel={request?.action ?? 'OK'}
      danger
      onCancel={() => setRequest(null)}
      onConfirm={() => {
        const yes = request?.onYes;
        setRequest(null);
        yes?.();
      }}
    />
  );
}
