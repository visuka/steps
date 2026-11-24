/**
 * A club's four tabs (spec T16f): Chat, Walks, Goals and Board, each its own
 * part so a later stage can swap one (walk plans, shared goals) without
 * touching the club screen. Theme roles and Spacing only.
 */
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EmptyState, Surface, ToggleRow } from '@/components/ui';
import { boardRows } from '@/buddies/clubs';
import { displayName } from '@/buddies/read';
import type { Club } from '@/buddies/types';
import { useBoard } from '@/buddies/use-clubs';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ChatBody } from '../chat-body';

export type ClubTab = 'chat' | 'walks' | 'goals' | 'board';
export const CLUB_TABS: { value: ClubTab; text: string }[] = [
  { value: 'chat', text: 'Chat' },
  { value: 'walks', text: 'Walks' },
  { value: 'goals', text: 'Goals' },
  { value: 'board', text: 'Board' },
];
export const isClubTab = (v: unknown): v is ClubTab => CLUB_TABS.some((t) => t.value === v);

/** The club chat: the buddy chat's body on key c.<clubId>, with each sender's @handle. */
export function ClubChatTab({ club, show, onReportMessage }: { club: Club; show: (m: string | null) => void; onReportMessage: (ref: string) => void }) {
  return <ChatBody chatKey={`c.${club.clubId}`} name={club.name} group show={show} onReportMessage={onReportMessage} />;
}

/** Planned walks: the next stage fills this tab. */
export function ClubWalksTab() {
  return (
    <TabScroll>
      <EmptyState icon="walk-outline" title="Planned walks" hint="Planning walks with your club comes next: a time, a meeting point and who's coming." />
    </TabScroll>
  );
}

/** Shared goals: says whether the club has them; the goals themselves come next. */
export function ClubGoalsTab({ club }: { club: Club }) {
  return (
    <TabScroll>
      <EmptyState
        icon="checkbox-outline"
        title={club.goals ? 'Shared goals are on' : 'No shared goals'}
        hint={
          club.goals
            ? 'The captain and vice-captains will set goals here, like steps or medicines. Each member marks them done.'
            : 'The captain can turn on shared goals in Edit club.'
        }
      />
    </TabScroll>
  );
}

/**
 * This week's steps (Monday to Sunday) for the members who turned it on,
 * high first. My own switch is at the top; turning it off takes me off the board.
 */
export function ClubBoardTab({ club, onBoard }: { club: Club; onBoard: (on: boolean) => void }) {
  const theme = useTheme();
  const board = useBoard(club.clubId);
  const rows = boardRows(board.data?.rows ?? []);
  return (
    <TabScroll onRefresh={board.refresh}>
      <Surface level={1} style={styles.list}>
        <ToggleRow title="Show my steps on the board" value={club.myBoard} onValueChange={onBoard} />
      </Surface>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gap} maxFontSizeMultiplier={1.3}>
        This week (Mon–Sun). Only members who turn it on.
      </ThemedText>
      {board.error ? (
        <ThemedText themeColor="error" style={styles.gap}>
          {board.error}
        </ThemedText>
      ) : null}
      {board.data && !rows.length ? (
        <ThemedText themeColor="onSurfaceVariant" style={styles.gap} maxFontSizeMultiplier={1.3}>
          No one is on the board yet this week.
        </ThemedText>
      ) : null}
      {rows.length ? (
        <Surface level={1} style={[styles.list, styles.gap]}>
          {rows.map((r, i) => {
            const name = displayName(r.walker);
            const steps = r.weekSteps.toLocaleString('en-IN');
            const me = r.walker.relation === 'self';
            return (
              <View
                key={r.walker.pid}
                accessible
                accessibilityLabel={`${r.rank}, ${me ? 'You' : name}, ${steps} steps`}
                style={[styles.row, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.outlineVariant } : null]}>
                <ThemedText type="titleSmall" themeColor="onSurfaceVariant" style={styles.rank} maxFontSizeMultiplier={1.3}>
                  {String(r.rank)}
                </ThemedText>
                <ThemedText numberOfLines={1} style={styles.grow} maxFontSizeMultiplier={1.3}>
                  {me ? `${name} (you)` : name}
                </ThemedText>
                <ThemedText type="titleSmall" maxFontSizeMultiplier={1.3}>
                  {steps}
                </ThemedText>
              </View>
            );
          })}
        </Surface>
      ) : null}
    </TabScroll>
  );
}

function TabScroll({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.grow}
      contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + Spacing.four }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} /> : undefined}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pad: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  list: { overflow: 'hidden' },
  gap: { marginTop: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 48, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  rank: { minWidth: Spacing.four, textAlign: 'right' },
});
