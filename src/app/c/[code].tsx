import { Redirect, useLocalSearchParams } from 'expo-router';

import { cleanClubCode } from '@/buddies/qr/links';

/**
 * A club link, neutcraftssteps://c/<code> (a Club QR code read by the phone's
 * own camera, or a shared link): the club's card, then Ask to join (or the
 * goals consent first). A broken link goes to Buddies.
 */
export default function ClubLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const c = code ? cleanClubCode(code) : null;
  return c ? <Redirect href={{ pathname: '/buddies/scan', params: { code: c } } as never} /> : <Redirect href="/plus" />;
}
