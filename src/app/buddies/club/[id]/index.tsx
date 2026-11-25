import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClubBoardTab, ClubChatTab, ClubGoalsTab, ClubWalksTab, CLUB_TABS, isClubTab, type ClubTab } from '@/components/buddies/clubs/club-tabs';
import { useSnack } from '@/components/buddies/parts';
import { SafetySheet } from '@/components/buddies/plans/safety-sheet';
import { ReportSheet } from '@/components/buddies/report-sheet';
import { PlainGround, Segments } from '@/components/plain/plain-kit';
import { LockedClubs } from '@/components/buddies/clubs/locked-clubs';
import { PremiumCard } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { BackButton, Button, Card, Dialog, IconButton, ListRow, Screen, Sheet, Snackbar } from '@/components/ui';
import { SCREEN, subtitleIndent } from '@/components/ui/screen-style';
import { can, canPlanClubWalk, clubLine, isStaff, leaveAsk } from '@/buddies/clubs';
import type { Club, Message } from '@/buddies/types';
import { attempt, useSocialApi } from '@/buddies/use-buddies';
import { useClub, useStepsShare } from '@/buddies/use-clubs';
import { useSafetyTips } from '@/buddies/use-plans';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SCREEN_FEATURES } from '@/premium/premium';
import { usePremium } from '@/state/use-premium';

/**
 * A club (spec T16f): Chat · Walks · Goals · Board for members; for anyone
 * else the club's line, what it is about and Ask to join (or the invite).
 * The menu: members and requests (captain, vice-captains), Invite a buddy,
 * Edit club, Delete club (captain), Report club and Leave club (the captain
 * too: the club passes at once to the vice-captain who joined first, else the
 * member who joined first). Without Premium: the premium card, and Leave club /
 * Stop goal tracking, which stay free.
 */
export default function ClubScreen() {
  // ?ask=leave opens the Leave dialog (the design preview's captain leave shot).
  const { id, seg, ask: askParam } = useLocalSearchParams<{ id: string; seg?: string; ask?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const api = useSocialApi();
  const premium = usePremium();
  const c = useClub(id);
  useStepsShare();
  const [tab, setTab] = useState<ClubTab>(isClubTab(seg) ? seg : 'chat');
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState<'leave' | 'delete' | null>(askParam === 'leave' ? 'leave' : null);
  const [report, setReport] = useState<{ kind: 'club' | 'message'; ref: string; label: string; author?: Message['from'] } | null>(null);
  const [busy, setBusy] = useState(false);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const club = c.club;
  const role = club?.myRole ?? null;
  const name = club?.name ?? 'Club';
  // The captain's dialog names who takes over, from the member list (clubs.ts heirOf).
  const leaving = leaveAsk(role, club?.memberCount ?? 0, name, c.members);
  // The safety tips, once, the first time I'm in a club (docs/walk-buddies.md 6.4).
  const tips = useSafetyTips('club', club?.myState === 'member');

  const join = async () => {
    if (!club) return;
    if (club.goals) {
      router.push({ pathname: '/buddies/club/[id]/join', params: { id: club.clubId } });
      return;
    }
    setBusy(true);
    const r = await c.join();
    setBusy(false);
    // The captain turned goals on since this page loaded: the consent comes first.
    if (r.state === 'needs_consent') return router.push({ pathname: '/buddies/club/[id]/join', params: { id: club.clubId } });
    show(r.err ?? (r.state === 'member' ? `You're in ${club.name}.` : 'Asked. The captain or a vice-captain will let you in.'));
  };

  const run = async (action: () => Promise<string | null>, done: string | null) => {
    setBusy(true);
    const err = await action();
    setBusy(false);
    show(err ?? done);
    return err;
  };

  const go = (pathname: '/buddies/club/[id]/admin' | '/buddies/club/new', params: Record<string, string>) => {
    setMenu(false);
    router.push({ pathname, params } as never);
  };

  if (premium.isLocked(SCREEN_FEATURES.buddies)) {
    return (
      <Screen title={name} onBack={back} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        <PremiumCard />
        <LockedClubs only={id} show={show} />
      </Screen>
    );
  }

  return (
    <>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: theme.background }]}>
        <PlainGround />
        <View style={[styles.top, { paddingTop: insets.top + Spacing.one }]}>
          {/* The same back chevron and title as every pushed screen (Screen). */}
          <BackButton onPress={back} />
          <ThemedText
            type="headlineSmall"
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.grow}
            maxFontSizeMultiplier={1.3}>
            {name}
          </ThemedText>
          {club ? <IconButton icon="ellipsis-vertical" accessibilityLabel="Club menu" onPress={() => setMenu(true)} /> : null}
        </View>

        {!club ? (
          <View style={styles.pad}>
            {c.error ? (
              <>
                <ThemedText themeColor="onSurfaceVariant">{c.error}</ThemedText>
                <Button label="Try again" variant="text" compact onPress={c.refresh} style={styles.start} />
              </>
            ) : (
              <ThemedText themeColor="onSurfaceVariant">—</ThemedText>
            )}
          </View>
        ) : club.myState !== 'member' ? (
          <Visitor club={club} busy={busy} onJoin={join} onCancel={() => run(c.cancelJoin, 'Request cancelled.')} onDecline={() => run(c.declineInvite, null).then((e) => !e && back())} />
        ) : (
          <>
            <View style={styles.head}>
              {/* Indented under the title past the chevron, like every pushed screen's subtitle. */}
              <ThemedText type="bodySmall" themeColor="onSurfaceVariant" numberOfLines={2} maxFontSizeMultiplier={1.3} style={styles.headLine}>
                {headLine(club)}
              </ThemedText>
              <Segments parts={CLUB_TABS} value={tab} onChange={setTab} stretch spoken={(v) => `${CLUB_TABS.find((t) => t.value === v)?.text} tab`} />
            </View>
            {tab === 'chat' ? (
              <ClubChatTab
                club={club}
                show={show}
                onReportMessage={(ref, author) => setReport({ kind: 'message', ref, label: `message from @${author.handle}`, author })}
              />
            ) : tab === 'walks' ? (
              <ClubWalksTab club={club} canPlan={canPlanClubWalk(role)} />
            ) : tab === 'goals' ? (
              <ClubGoalsTab club={club} show={show} />
            ) : (
              <ClubBoardTab
                club={club}
                onBoard={async (on) => show((await c.setBoard(on)) ?? (on ? 'Your steps are on the board.' : 'Your steps are off the board.'))}
              />
            )}
          </>
        )}
        <Snackbar message={snack} onDismiss={dismiss} />
      </KeyboardAvoidingView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={name}>
        {club && isStaff(role) ? (
          <ListRow title="Members and requests" icon="people-outline" chevron onPress={() => go('/buddies/club/[id]/admin', { id: club.clubId })} />
        ) : null}
        {club && can(role, 'invite') ? (
          <ListRow title="Invite a buddy" icon="person-add-outline" onPress={() => go('/buddies/club/[id]/admin', { id: club.clubId, invite: '1' })} />
        ) : null}
        {club && can(role, 'edit') ? <ListRow title="Edit club" icon="create-outline" onPress={() => go('/buddies/club/new', { id: club.clubId })} /> : null}
        {club && can(role, 'delete') ? <ListRow title="Delete club" icon="trash-outline" onPress={() => (setMenu(false), setAsk('delete'))} /> : null}
        {club ? <ListRow title="Report club" icon="flag-outline" onPress={() => (setMenu(false), setReport({ kind: 'club', ref: club.clubId, label: 'club' }))} /> : null}
        {/* The captain can leave too: the club passes at once to a vice-captain (or the earliest member). */}
        {club && can(role, 'leave') ? (
          <ListRow title="Leave club" icon="exit-outline" onPress={() => (setMenu(false), setAsk('leave'))} />
        ) : null}
      </Sheet>

      <Dialog
        visible={ask === 'leave'}
        title={leaving.title}
        message={leaving.message}
        confirmLabel={leaving.confirm}
        danger
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          setAsk(null);
          const err = await run(c.leave, `You left ${name}.`);
          if (!err) back();
        }}
      />
      <Dialog
        visible={ask === 'delete'}
        title={`Delete ${name}?`}
        message="The club, its chat, board, goals and everyone's goal history are deleted for every member. This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          setAsk(null);
          const err = await run(c.remove, `Deleted ${name}.`);
          if (!err) back();
        }}
      />

      <SafetySheet visible={tips.open} onClose={tips.close} />

      <ReportSheet
        visible={!!report}
        label={report?.label ?? ''}
        // A club message's sender can be blocked too (spec 5.1); a block hides each other's club messages (5.4).
        canBlock={report?.kind === 'message' && !!report.author}
        onClose={() => setReport(null)}
        onSend={async (reason, note, alsoBlock) => {
          const r = report;
          setReport(null);
          if (!r) return;
          const err =
            r.kind === 'club'
              ? await c.report(reason, note)
              : await attempt(async () => {
                  await api.report({ kind: 'message', ref: r.ref, reason, note: note || undefined });
                  if (alsoBlock && r.author) await api.block(r.author.pid);
                });
          show(err ?? 'Thanks. Steps reviews every report, urgent ones within 24 hours.');
        }}
      />
    </>
  );
}

/** "Banjara Hills · 48 members · Captain @ravi_walks", or "… · You're the captain". */
function headLine(club: Club): string {
  return [clubLine(club), captainWords(club)].filter(Boolean).join(' · ');
}

/** "Captain @ravi_walks", "You're the captain", or nothing. */
function captainWords(club: Club): string | null {
  return club.captain ? (club.captain.relation === 'self' ? "You're the captain" : `Captain @${club.captain.handle}`) : null;
}

/** Not a member yet: what the club is, and Ask to join, Cancel, or the invite's Join and Decline. */
function Visitor({
  club,
  busy,
  onJoin,
  onCancel,
  onDecline,
}: {
  club: Club;
  busy: boolean;
  onJoin: () => void;
  onCancel: () => void;
  onDecline: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + Spacing.four }]}>
      {/* The club in one tile (its name is in the top bar), then the actions under it. */}
      <Card style={styles.info}>
        {/* The place line, then the captain on a line of its own: no line ends on a hanging " · ". */}
        <View>
          <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {clubLine(club)}
          </ThemedText>
          {captainWords(club) ? (
            <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
              {captainWords(club)}
            </ThemedText>
          ) : null}
        </View>
        {club.about ? <ThemedText maxFontSizeMultiplier={1.3}>{club.about}</ThemedText> : null}
        {club.goals ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            {"This club has shared goals. You'll see what the captain sees before you join."}
          </ThemedText>
        ) : null}
        {club.myState === 'asked' ? (
          <ThemedText maxFontSizeMultiplier={1.3}>Asked. The captain or a vice-captain will let you in.</ThemedText>
        ) : club.myState === 'invited' ? (
          <ThemedText maxFontSizeMultiplier={1.3}>{"You're invited to this club."}</ThemedText>
        ) : null}
      </Card>
      {club.myState === 'asked' ? (
        <Button label="Cancel request" variant="outlined" onPress={onCancel} disabled={busy} />
      ) : club.myState === 'invited' ? (
        <>
          <Button label="Join" onPress={onJoin} loading={busy} disabled={busy} />
          <Button label="Decline" variant="text" onPress={onDecline} disabled={busy} />
        </>
      ) : (
        <>
          <Button label="Ask to join" onPress={onJoin} loading={busy} disabled={busy} />
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            The captain or a vice-captain approves each request. Members see your walker ID.
          </ThemedText>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  // The chevron sits where Screen puts it (24 margin, -4), the title 8 after it.
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SCREEN.back.titleGap,
    minHeight: SCREEN.topBarHeight,
    paddingLeft: SCREEN.sideMargin,
    paddingRight: Spacing.two,
    paddingBottom: Spacing.one,
  },
  info: { gap: Spacing.two },
  headLine: { marginLeft: subtitleIndent() },
  head: { paddingHorizontal: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  pad: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  start: { alignSelf: 'flex-start' },
});
