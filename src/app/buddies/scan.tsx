import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useSnack } from '@/components/buddies/parts';
import { QrCamera } from '@/components/buddies/qr/qr-camera';
import { ClubCardSheet } from '@/components/buddies/qr/qr-sheets';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Screen, Sheet, Snackbar } from '@/components/ui';
import { cardAction, scanMessage, scanOutcome } from '@/buddies/qr/club-code';
import { cleanClubCode, spacedCode } from '@/buddies/qr/links';
import { useSocialMe } from '@/buddies/use-buddies';
import { useClubByCode } from '@/buddies/use-qr';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

const BAD_CODE = "That club code isn't right. Check it with the captain.";

/**
 * Scan a QR code (docs/walk-buddies.md 2.4, 7.3): a walker's code opens Find
 * with their walker ID (then Ask); a club's code opens the club's card (then
 * Ask to join, or the goals consent first). `code` (a club link, or the
 * preview) opens that club's card without the camera.
 */
export default function ScanQr() {
  // &typing=1 opens the Enter a club code sheet (the design preview photographs it).
  const { code: codeParam, typing: typingParam } = useLocalSearchParams<{ code?: string; typing?: string }>();
  const router = useRouter();
  const { me } = useSocialMe();
  const myHandle = me && me.joined ? me.handle : null;
  const linked = codeParam ? cleanClubCode(codeParam) : null;
  const [camera, setCamera] = useState(!linked);
  const [club, setClub] = useState<string | null>(linked);
  const [hint, setHint] = useState<string | null>(codeParam && !linked ? BAD_CODE : null);
  const [typing, setTyping] = useState(typingParam === '1');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const found = useClubByCode(club);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const findById = () => router.push('/buddies/find');

  const onText = (text: string) => {
    const o = scanOutcome(text, myHandle);
    if (o.kind === 'walker') {
      setHint(null);
      router.push({ pathname: '/buddies/find', params: { handle: o.handle } } as never);
    } else if (o.kind === 'club') {
      setHint(null);
      setClub(o.code);
    } else setHint(scanMessage(o));
  };

  const closeCard = () => {
    setClub(null);
    if (!camera) back();
  };

  const openClub = (id: string) => router.replace({ pathname: '/buddies/club/[id]', params: { id } } as never);

  const act = async () => {
    const card = found.card;
    if (!card || !club) return;
    const a = cardAction(card);
    if (a === 'open') return openClub(card.clubId);
    if (card.goals) {
      setClub(null);
      return router.push({ pathname: '/buddies/club/[id]/join', params: { id: card.clubId, code: club } } as never);
    }
    setBusy(true);
    const r = await found.join(false);
    setBusy(false);
    if (r.state === 'needs_consent') {
      setClub(null);
      return router.push({ pathname: '/buddies/club/[id]/join', params: { id: card.clubId, code: club } } as never);
    }
    if (r.err) return show(r.err);
    if (r.state === 'member') {
      show(`You're in ${card.name}.`);
      return openClub(card.clubId);
    }
    show('Asked. The captain or a vice-captain will let you in.');
  };

  const typedCode = cleanClubCode(typed);
  const findTyped = () => {
    if (!typedCode) return;
    setTyping(false);
    setTyped('');
    setHint(null);
    setClub(typedCode);
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Scan a QR code" onBack={back}>
      <Screen title="Scan a QR code" onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {camera ? (
          <QrCamera paused={!!club || typing} hint={hint} onText={onText} onManual={findById} />
        ) : (
          <>
            <ThemedText themeColor="onSurfaceVariant">{linked ? `Club code ${spacedCode(linked)}` : '—'}</ThemedText>
            <Button label="Scan a QR code" variant="tonal" icon="camera-outline" onPress={() => setCamera(true)} />
          </>
        )}
        <Button label="Enter a club code" variant="text" onPress={() => setTyping(true)} style={styles.start} />
        <Sheet visible={typing} onClose={() => setTyping(false)} title="Enter a club code">
          <ThemedText themeColor="onSurfaceVariant">The 8 letters and numbers the captain shared.</ThemedText>
          <TextField label="Club code" value={typed} onChangeText={setTyped} placeholder="K7QM 2XPA" maxLength={12} plain autoFocus onSubmit={findTyped} returnKeyType="go" />
          <Button label="Find club" onPress={findTyped} disabled={!typedCode} />
          <Button label="Not now" variant="text" onPress={() => setTyping(false)} />
        </Sheet>
        <ClubCardSheet visible={!!club} onClose={closeCard} card={found.card} error={found.error} busy={busy} onAction={act} />
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start', marginTop: Spacing.two },
});
