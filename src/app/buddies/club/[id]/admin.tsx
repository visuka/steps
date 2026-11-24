import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PersonRow, SectionTitle, useSnack } from '@/components/buddies/parts';
import { ClubQrSheet } from '@/components/buddies/qr/qr-sheets';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Dialog, ListRow, Screen, Sheet, Snackbar, Surface } from '@/components/ui';
import { can, canRemove, ROLE_WORD, roleChange, sortMembers } from '@/buddies/clubs';
import { displayName } from '@/buddies/read';
import { type ClubMember, REPORT_REASONS } from '@/buddies/types';
import { useClubAdmin } from '@/buddies/use-clubs';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

/**
 * Running a club (captain and vice-captains): who is asking to join
 * (Approve / Decline), the members with their roles (Make vice-captain,
 * Remove), Invite a buddy, the Club QR code (a join code that works for 48
 * hours; every member is still approved here) and reports from the club chat.
 */
export default function ClubAdminScreen() {
  const { id, invite, qr } = useLocalSearchParams<{ id: string; invite?: string; qr?: string }>();
  const router = useRouter();
  const a = useClubAdmin(id);
  const [inviting, setInviting] = useState(invite === '1');
  const [showQr, setShowQr] = useState(qr === '1');
  const [picked, setPicked] = useState<ClubMember | null>(null);
  const [removing, setRemoving] = useState<ClubMember | null>(null);
  const { snack, show, dismiss } = useSnack();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));

  const role = a.club?.myRole ?? null;
  const members = sortMembers(a.members);
  const myPid = members.find((m) => m.walker.relation === 'self')?.walker.pid ?? null;
  const inClub = new Set(members.map((m) => m.walker.pid));
  const canInvite = a.buddies.filter((b) => !inClub.has(b.walker.pid));
  const change = picked && can(role, 'setRole') ? roleChange(picked, members) : null;
  const removable = picked ? canRemove(role, picked, myPid) : false;

  const act = async (action: () => Promise<string | null>, done: string) => show((await action()) ?? done);

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Members" onBack={back}>
      <Screen title="Members" subtitle={a.club?.name} onBack={back} onRefresh={a.refresh} refreshing={false} overlay={<Snackbar message={snack} onDismiss={dismiss} />}>
        {a.error ? <ThemedText themeColor="error">{a.error}</ThemedText> : null}
        {can(role, 'invite') ? <Button label="Invite a buddy" icon="person-add-outline" variant="tonal" onPress={() => setInviting(true)} /> : null}
        {can(role, 'code') ? <Button label="Club QR code" icon="qr-code-outline" variant="tonal" onPress={() => setShowQr(true)} /> : null}

        <SectionTitle>Asking to join</SectionTitle>
        {a.requests.length ? (
          <Surface level={1} style={styles.list}>
            {a.requests.map((r) => (
              <View key={r.walker.pid}>
                <PersonRow walker={r.walker} />
                <View style={styles.actions}>
                  <Button label="Decline" variant="text" compact onPress={() => act(() => a.decline(r.walker.pid), `Declined @${r.walker.handle}.`)} />
                  <Button label="Approve" variant="text" compact onPress={() => act(() => a.approve(r.walker.pid), `@${r.walker.handle} is in.`)} />
                </View>
              </View>
            ))}
          </Surface>
        ) : (
          <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            No one is asking right now.
          </ThemedText>
        )}

        <SectionTitle>{`Members · ${members.length}`}</SectionTitle>
        <Surface level={1} style={styles.list}>
          {members.map((m) => {
            const me = m.walker.relation === 'self';
            const word = ROLE_WORD[m.role];
            const options = !me && ((can(role, 'setRole') && !!roleChange(m, members)) || canRemove(role, m, myPid));
            return (
              <PersonRow
                key={m.walker.pid}
                walker={m.walker}
                supporting={me ? `${word} · You` : `${word} · @${m.walker.handle}`}
                onPress={options ? () => setPicked(m) : undefined}
              />
            );
          })}
        </Surface>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.note} maxFontSizeMultiplier={1.3}>
          A club has 1 captain and up to 2 vice-captains. Tap a member to change their role or remove them.
        </ThemedText>

        {can(role, 'reports') ? (
          <>
            <SectionTitle>Reports</SectionTitle>
            {a.reports.length ? (
              <Surface level={1} style={styles.list}>
                {a.reports.map((r) => (
                  <View key={r.reportId} style={styles.report}>
                    <ThemedText maxFontSizeMultiplier={1.3}>{r.text || 'A report'}</ThemedText>
                    <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
                      {`Reported: ${REPORT_REASONS.find((x) => x.key === r.reason)?.label ?? r.reason}`}
                    </ThemedText>
                    <View style={styles.actionsFlat}>
                      <Button label="Dismiss" variant="text" compact onPress={() => act(() => a.closeReport(r.reportId, 'dismiss'), 'Dismissed.')} />
                      {r.kind === 'message' ? (
                        <Button label="Delete message" variant="text" danger compact onPress={() => act(() => a.closeReport(r.reportId, 'removed'), 'Message deleted.')} />
                      ) : null}
                    </View>
                  </View>
                ))}
              </Surface>
            ) : (
              <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
                No reports.
              </ThemedText>
            )}
          </>
        ) : null}
      </Screen>

      {a.club && can(role, 'code') ? <ClubQrSheet visible={showQr} onClose={() => setShowQr(false)} clubId={a.club.clubId} clubName={a.club.name} /> : null}

      <Sheet visible={!!picked} onClose={() => setPicked(null)} title={picked ? displayName(picked.walker) : ''}>
        {picked && change ? (
          <ListRow
            title={change.label}
            icon="ribbon-outline"
            onPress={() => {
              const m = picked;
              setPicked(null);
              void act(() => a.setRole(m.walker.pid, change.to), `${displayName(m.walker)} is now ${change.to === 'admin' ? 'a vice-captain' : 'a member'}.`);
            }}
          />
        ) : null}
        {picked && removable ? <ListRow title="Remove from club" icon="person-remove-outline" onPress={() => (setRemoving(picked), setPicked(null))} /> : null}
      </Sheet>

      <Dialog
        visible={!!removing}
        title={removing ? `Remove ${displayName(removing.walker)}?` : ''}
        message="They leave the club chat and the board. They can ask to join again later."
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const m = removing;
          setRemoving(null);
          if (m) void act(() => a.removeMember(m.walker.pid), `Removed ${displayName(m.walker)}.`);
        }}
      />

      <Sheet visible={inviting} onClose={() => setInviting(false)} title="Invite a buddy">
        {canInvite.length ? (
          canInvite.map((b) => (
            <PersonRow
              key={b.walker.pid}
              walker={b.walker}
              trailing={<Button label="Invite" variant="text" compact onPress={() => act(() => a.invite(b.walker.pid), `Invited ${displayName(b.walker)}.`)} />}
            />
          ))
        ) : (
          <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
            All your buddies are in this club, or you have no buddies yet.
          </ThemedText>
        )}
      </Sheet>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two, marginTop: -Spacing.two },
  actionsFlat: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.one },
  note: { marginTop: Spacing.two },
  report: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.one },
});
