/**
 * Clubs, shared pieces for the screens pushed over Buddies: a club row and
 * the goals consent (spec T16f, the goals contract). Theme roles and Spacing
 * only; numbers and words, no emoji.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ListRow, Surface } from '@/components/ui';
import { clubLine, ROLE_WORD, stateWord } from '@/buddies/clubs';
import type { ClubCard, ClubRole } from '@/buddies/types';
import { Spacing } from '@/constants/theme';

import { Avatar } from '../parts';

/** A club in a list: initial, name over "area · members", then where I stand or an action. */
export function ClubRow({
  club,
  onPress,
  trailing,
  hideState,
}: {
  club: ClubCard;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** Leave out where I stand (a list that already says it, like Club invites). */
  hideState?: boolean;
}) {
  const line = clubLine(club);
  const state = stateWord(club);
  return (
    <ListRow
      title={club.name}
      supporting={line}
      leading={<Avatar label={club.name} />}
      trailing={trailing}
      trailingText={trailing || hideState ? undefined : state}
      onPress={onPress}
      accessibilityLabel={`${club.name}, ${line}, ${state}`}
    />
  );
}

/** "Captain", "Vice-captain" or "Member". */
export function RoleText({ role }: { role: ClubRole }) {
  return (
    <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
      {ROLE_WORD[role]}
    </ThemedText>
  );
}

/** The plain words a club with shared goals shows before anyone joins. */
export const CONSENT_SEE = ['Done or not done for each goal', 'Your step total, only for step goals', 'Your name and walker ID'];
export const CONSENT_NEVER = ['Your food', 'Your sleep details', 'Where you are', 'Your other chats'];
export const CONSENT_LEAVE = 'Leave any time — your goal history here is deleted.';

/**
 * The goals consent: what the captain and vice-captains will see, what they
 * never see, and Join / Not now. Nothing is sent until Join.
 */
export function GoalsConsent({ club, busy, onJoin, onNotNow }: { club: ClubCard; busy: boolean; onJoin: () => void; onNotNow: () => void }) {
  return (
    <View style={styles.gap}>
      <ThemedText maxFontSizeMultiplier={1.3}>{`${club.name} has shared goals. The captain and vice-captains can set goals for members, like steps or medicines.`}</ThemedText>
      <List title="What the captain and vice-captains see" rows={CONSENT_SEE} />
      <List title="What they never see" rows={CONSENT_NEVER} />
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        {CONSENT_LEAVE}
      </ThemedText>
      <Button label="Join" onPress={onJoin} loading={busy} disabled={busy} />
      <Button label="Not now" variant="text" onPress={onNotNow} disabled={busy} />
    </View>
  );
}

function List({ title, rows }: { title: string; rows: string[] }) {
  return (
    <View>
      <ThemedText type="titleSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3} style={styles.title}>
        {title}
      </ThemedText>
      <Surface level={1} style={styles.box}>
        {rows.map((r) => (
          <ThemedText key={r} maxFontSizeMultiplier={1.3} style={styles.row}>
            {r}
          </ThemedText>
        ))}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.three },
  title: { marginBottom: Spacing.one },
  box: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  row: { paddingVertical: Spacing.one },
});
