/**
 * Buddies QR sheets (docs/walk-buddies.md 2.4 and 7.3): My QR (from the
 * walker ID tile), the Club QR for the captain and vice-captains (Club admin)
 * and the club card a scanned club code opens. Theme roles, Spacing and
 * PLAIN_QR only; numbers and words, no emoji. The data comes from hooks
 * (use-qr.tsx), never from the API here.
 */
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Sheet } from '@/components/ui';
import { PLAIN_QR } from '@/components/plain/plain-theme';
import { clubLine } from '@/buddies/clubs';
import { cardAction, cardButton } from '@/buddies/qr/club-code';
import { clubLink, clubShareText, spacedCode, walkerLink, walkerShareText } from '@/buddies/qr/links';
import { displayName } from '@/buddies/read';
import type { ClubCard } from '@/buddies/types';
import { useClubQr } from '@/buddies/use-qr';
import { Spacing } from '@/constants/theme';

import { QrCode } from './qr-code';

/** The QR's side on this phone: the sheet's width less its margins, at most PLAIN_QR.maxSide. */
function useQrSide(): number {
  const { width } = useWindowDimensions();
  return Math.max(0, Math.min(width - Spacing.four * 2, PLAIN_QR.maxSide));
}

/** My QR: my walker link as a QR, my walker ID under it, Share and Done. */
export function MyQrSheet({ visible, onClose, handle }: { visible: boolean; onClose: () => void; handle: string }) {
  const side = useQrSide();
  return (
    <Sheet visible={visible} onClose={onClose} title="My QR code">
      <View style={styles.center}>
        <QrCode value={walkerLink(handle)} side={side} label={`QR code for your walker ID, @${handle}`} />
        <ThemedText type="titleMedium" style={styles.mid} numberOfLines={1} adjustsFontSizeToFit>
          {`@${handle}`}
        </ThemedText>
        <ThemedText themeColor="onSurfaceVariant" style={styles.mid}>
          Friends scan this to add you
        </ThemedText>
      </View>
      <Button label="Share" onPress={() => Share.share({ message: walkerShareText(handle) })} accessibilityLabel="Share your walker ID" />
      <Button label="Done" variant="text" onPress={onClose} />
    </Sheet>
  );
}

/** The club's join code as a QR, for its captain and vice-captains: Share and New code. */
export function ClubQrSheet({ visible, onClose, clubId, clubName }: { visible: boolean; onClose: () => void; clubId: string; clubName: string }) {
  const side = useQrSide();
  const { code, busy, error, renew } = useClubQr(clubId, visible);
  return (
    <Sheet visible={visible} onClose={onClose} title="Club QR code">
      <View style={styles.center}>
        {code ? (
          <QrCode value={clubLink(code.code)} side={side} label={`QR code to join ${clubName}, code ${spacedCode(code.code)}`} />
        ) : (
          <View style={[styles.empty, { width: side, height: side }]}>
            <ThemedText themeColor={error ? 'error' : 'onSurfaceVariant'} style={styles.mid}>
              {error ?? '—'}
            </ThemedText>
          </View>
        )}
        {code ? (
          <ThemedText type="titleMedium" style={styles.mid} accessibilityLabel={`Code ${code.code.split('').join(' ')}`}>
            {spacedCode(code.code)}
          </ThemedText>
        ) : null}
        <ThemedText themeColor="onSurfaceVariant" style={styles.mid}>
          Works for 48 hours. You approve every member.
        </ThemedText>
        {code && error ? (
          <ThemedText themeColor="error" style={styles.mid}>
            {error}
          </ThemedText>
        ) : null}
      </View>
      <Button
        label="Share"
        disabled={!code}
        onPress={() => code && Share.share({ message: clubShareText(clubName, code.code) })}
        accessibilityLabel={`Share the code for ${clubName}`}
      />
      <Button label="New code" variant="tonal" loading={busy} onPress={() => void renew()} accessibilityHint="The old code stops working" />
      <Button label="Done" variant="text" onPress={onClose} />
    </Sheet>
  );
}

/**
 * A club found by its code: name, "area · members", the captain, whether it
 * has shared goals, then Ask to join / Join / Open club and Not now.
 */
export function ClubCardSheet({
  visible,
  onClose,
  card,
  error,
  busy,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  card: ClubCard | null;
  error: string | null;
  busy: boolean;
  onAction: () => void;
}) {
  const action = card ? cardAction(card) : null;
  const button = action ? cardButton(action) : null;
  return (
    <Sheet visible={visible} onClose={onClose} title={card?.name ?? 'Club'}>
      {card ? (
        <View style={styles.list}>
          <ThemedText themeColor="onSurfaceVariant">{clubLine(card)}</ThemedText>
          {card.captain ? <ThemedText>{`Captain: ${displayName(card.captain)}`}</ThemedText> : null}
          {card.goals ? <ThemedText>This club has shared goals</ThemedText> : null}
          {action === 'asked' ? <ThemedText themeColor="onSurfaceVariant">Asked. The captain or a vice-captain will let you in.</ThemedText> : null}
        </View>
      ) : (
        <ThemedText themeColor={error ? 'error' : 'onSurfaceVariant'}>{error ?? '—'}</ThemedText>
      )}
      {card && error ? <ThemedText themeColor="error">{error}</ThemedText> : null}
      {button ? <Button label={button} loading={busy} onPress={onAction} /> : null}
      <Button label={action === 'asked' || !card ? 'Done' : 'Not now'} variant="text" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.two },
  mid: { textAlign: 'center' },
  list: { gap: Spacing.two },
  empty: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
