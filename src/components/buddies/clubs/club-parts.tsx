/**
 * Clubs, shared pieces for the screens pushed over Buddies: a club row and
 * the goals consent (spec T16f, the goals contract). Theme roles and Spacing
 * only; numbers and words, no emoji.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Label } from '@/components/plain/plain-kit';
import { ThemedText } from '@/components/themed-text';
import { Button, ListRow, Surface } from '@/components/ui';
import { clubLine, ROLE_WORD, stateWord } from '@/buddies/clubs';
import type { ClubCard, ClubRole } from '@/buddies/types';
import { Spacing } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';
import { useTheme } from '@/hooks/use-theme';

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

/**
 * The plain words a club with shared goals shows before anyone joins or turns
 * tracking on. They match what the server shares: the goal report (done, the
 * time of the mark, this week's days and whether ever done), the step total
 * for step goals, and the walker ID (a name only to buddies, people.view).
 */
export const CONSENT_SEE = [
  'Done or not done for each goal, and the time you marked it',
  'How many days you did it this week, and whether you ever did',
  'Your step total, only for step goals',
  'Your walker ID (your name only if you are buddies)',
];
export const CONSENT_NEVER = ['Your food', 'Your sleep details', 'Where you are', 'Your other chats'];
/** Goals the phone counts (goals-auto.ts): only done or not done goes, and the step total for step goals. */
export const CONSENT_AUTO = 'Steps, walk, water and sleep goals are marked for you from this phone. Only done or not done is sent, and the step total for step goals.';
export const CONSENT_REMIND = 'The captain can send a gentle reminder. You can turn these off in My goals.';
export const CONSENT_LEAVE = "Turn off tracking in the club's Goals tab, or leave, any time. Your goal history here is then deleted.";

/**
 * The goals consent: what the captain and vice-captains will see, what they
 * never see, and Join / Not now. Nothing is sent until Join (or `joinLabel`,
 * "Turn on tracking" for a member who joined before goals were on).
 */
export function GoalsConsent({
  club,
  busy,
  onJoin,
  onNotNow,
  joinLabel = 'Join',
}: {
  club: Pick<ClubCard, 'name'>;
  busy: boolean;
  onJoin: () => void;
  onNotNow: () => void;
  joinLabel?: string;
}) {
  return (
    <View style={styles.gap}>
      <ThemedText maxFontSizeMultiplier={1.3}>{`${club.name} has shared goals. The captain and vice-captains can set goals for members, like steps or medicines.`}</ThemedText>
      <ShareList title="What the captain and vice-captains see" rows={CONSENT_SEE} />
      <ShareList title="What they never see" rows={CONSENT_NEVER} never />
      {[CONSENT_AUTO, CONSENT_REMIND, CONSENT_LEAVE].map((line) => (
        <ThemedText key={line} type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {line}
        </ThemedText>
      ))}
      <Button label={joinLabel} onPress={onJoin} loading={busy} disabled={busy} />
      <Button label="Not now" variant="text" onPress={onNotNow} disabled={busy} />
    </View>
  );
}

/**
 * What goal tracking shares (or never shares): a tile label (icon and tracked
 * capitals, like every Buddies section) over a tile of
 * items, each with its own mark (a tick, or a cross for "never"), so a wrapped
 * item never reads as two. Shared by the consent and the tracking switch.
 */
export function ShareList({ title, rows, never }: { title: string; rows: string[]; never?: boolean }) {
  const theme = useTheme();
  return (
    <View>
      <Label icon={never ? 'lock' : 'check'} text={title} style={styles.title} />
      <Surface level={1} style={styles.box}>
        {rows.map((r) => (
          <View key={r} style={styles.row}>
            <Ionicons
              name={never ? 'close' : 'checkmark'}
              size={18}
              color={theme.onSurfaceVariant}
              style={styles.mark}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <ThemedText maxFontSizeMultiplier={1.3} style={styles.item}>
              {r}
            </ThemedText>
          </View>
        ))}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.three },
  title: { marginBottom: Spacing.one },
  box: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: Spacing.one },
  // The mark sits on the first line of its item.
  mark: { marginTop: 3 },
  item: { flex: 1 },
});

/**
 * While members choose a new captain: one frosted tile under the club's line,
 * "Choosing a new captain · ends Thu 6:00 pm" and Vote (the election screen).
 * The words wrap at large text; the button moves under them rather than squeeze.
 */
export function ElectionBanner({ text, button, onPress }: { text: string; button: string; onPress: () => void }) {
  return (
    <Surface level={1} style={bannerStyles.tile}>
      <ThemedText style={bannerStyles.text} maxFontSizeMultiplier={1.3}>
        {text}
      </ThemedText>
      <Button label={button} variant="tonal" compact onPress={onPress} accessibilityLabel={`${button}. ${text}`} />
    </Surface>
  );
}

const bannerStyles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  // Below this the button wraps under the words (scaled with the screen, no raw size).
  text: { flexGrow: 1, flexShrink: 1, flexBasis: scaled(160) },
});
