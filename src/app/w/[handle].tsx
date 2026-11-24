import { Redirect, useLocalSearchParams } from 'expo-router';

import { linkHandle } from '@/buddies/qr/links';

/**
 * A walker link, neutcraftssteps://w/<walker ID> (a scanned My QR code read
 * by the phone's own camera, or a shared link): Find walkers with that ID
 * looked up, then Ask. A broken link goes to Buddies.
 */
export default function WalkerLink() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const h = linkHandle(handle);
  return h ? <Redirect href={{ pathname: '/buddies/find', params: { handle: h } } as never} /> : <Redirect href="/plus" />;
}
