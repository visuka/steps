/**
 * A club's four tabs (spec T16f): Chat, Walks, Goals and Board, each its own
 * part so a later stage can swap one (walk plans, shared goals) without
 * touching the club screen. Theme roles and Spacing only.
 */
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, ListRow, Surface, ToggleRow } from '@/components/ui';
import { boardRows } from '@/buddies/clubs';
import { STAFF_PLANS_LINE } from '@/buddies/election';
import { planLine, standWord, upcoming } from '@/buddies/plans';
import { displayName } from '@/buddies/read';
import type { Club, Message } from '@/buddies/types';
import { useBoard } from '@/buddies/use-clubs';
import { usePlans } from '@/buddies/use-plans';
import { MaxContentWidth, Spacing, TouchTarget } from '@/constants/theme';
import { useClock } from '@/hooks/use-clock';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useTheme } from '@/hooks/use-theme';

import { ChatBody } from '../chat-body';
import { GoalsTabBody } from '../goals/goals-tab';

export type ClubTab = 'chat' | 'walks' | 'goals' | 'board';
export const CLUB_TABS: { value: ClubTab; text: string }[] = [
  { value: 'chat', text: 'Chat' },
  { value: 'walks', text: 'Walks' },
  { value: 'goals', text: 'Goals' },
  { value: 'board', text: 'Board' },
];
export const isClubTab = (v: unknown): v is ClubTab => CLUB_TABS.some((t) => t.value === v);

/** The club chat: the buddy chat's body on key c.<clubId>, with each sender's @handle. */
export function ClubChatTab({
  club,
  show,
  onReportMessage,
}: {
  club: Club;
  show: (m: string | null) => void;
  onReportMessage: (ref: string, author: Message['from']) => void;
}) {
  return <ChatBody chatKey={`c.${club.clubId}`} name={club.name} group show={show} onReportMessage={onReportMessage} />;
}

/**
 * The club's planned walks, soonest first. The captain and vice-captains (and the
 * acting captain during a vote) get Plan a club walk; members see who plans them
 * (owner, 24 Nov 2026), and can still open a walk and say if they're going.
 */
export function ClubWalksTab({ club, canPlan }: { club: Club; canPlan: boolean }) {
  const router = useRouter();
  const plans = usePlans();
  const now = useClock().now;
  const clock = useClockStyle();
  const list = upcoming((plans.data ?? []).filter((p) => p.club?.clubId === club.clubId), now);
  return (
    <TabScroll onRefresh={plans.refresh}>
      {canPlan ? (
        <Button label="Plan a club walk" onPress={() => router.push({ pathname: '/buddies/plan/new', params: { club: club.clubId } } as never)} />
      ) : (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {STAFF_PLANS_LINE}
        </ThemedText>
      )}
      {plans.error ? (
        <ThemedText themeColor="onSurfaceVariant" style={styles.gap}>
          {plans.error}
        </ThemedText>
      ) : null}
      {plans.data && !list.length ? (
        <EmptyState
          icon="walk-outline"
          title="No walks planned"
          hint={canPlan ? "Pick a time and a meeting place. Everyone in the club can see it and say if they're going." : "When one is planned, it shows here and you can say if you're going."}
        />
      ) : null}
      {list.length ? (
        <Surface level={1} style={[styles.list, styles.gap]}>
          {list.map((p, i) => (
            <ListRow
              key={p.planId}
              title={p.place}
              supporting={planLine(p, now, clock)}
              trailingText={standWord(p) || undefined}
              chevron
              onPress={() => router.push({ pathname: '/buddies/plan/[id]', params: { id: p.planId } } as never)}
              last={i === list.length - 1}
            />
          ))}
        </Surface>
      ) : null}
    </TabScroll>
  );
}

/** Shared goals: today's goals for me, and for the captain and vice-captains each goal's numbers and New goal. */
export function ClubGoalsTab({ club, show }: { club: Club; show: (m: string | null) => void }) {
  return (
    <TabScroll>
      <GoalsTabBody club={club} show={show} />
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
        <ThemedText themeColor="onSurfaceVariant" style={styles.gap}>
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
                  {me ? (name === 'You' ? 'You' : `${name} (you)`) : name}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: TouchTarget, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  // The rank starts on the row's 16 inset, the same edge as the toggle tile's title.
  rank: { minWidth: Spacing.three, textAlign: 'left', fontVariant: ['tabular-nums'] },
});
