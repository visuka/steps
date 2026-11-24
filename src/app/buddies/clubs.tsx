import { useRouter } from 'expo-router';
import { Keyboard, StyleSheet } from 'react-native';

import { ClubRow } from '@/components/buddies/clubs/club-parts';
import { SectionTitle } from '@/components/buddies/parts';
import { TextField } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, Surface } from '@/components/ui';
import type { ClubCard } from '@/buddies/types';
import { useClubSearch, useMyClubs } from '@/buddies/use-clubs';
import { Spacing } from '@/constants/theme';
import { SCREEN_FEATURES } from '@/premium/premium';

/** Find a club by its name or area, see my clubs, or start one. */
export default function ClubSearch() {
  const router = useRouter();
  const s = useClubSearch();
  const mine = useMyClubs();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plus'));
  const open = (c: ClubCard) => router.push({ pathname: '/buddies/club/[id]', params: { id: c.clubId } } as never);
  const search = () => {
    Keyboard.dismiss();
    void s.search();
  };

  return (
    <PremiumGate feature={SCREEN_FEATURES.buddies} title="Find a club" onBack={back}>
      <Screen title="Find a club" onBack={back}>
        <TextField label="Club name or area" value={s.q} onChangeText={s.setQ} placeholder="e.g. KBR or Banjara Hills" maxLength={40} onSubmit={search} returnKeyType="search" />
        <Button label="Search" icon="search-outline" onPress={search} loading={s.busy} disabled={!s.q.trim() || s.busy} style={styles.gap} />
        {s.error ? (
          <ThemedText themeColor="error" style={styles.gap}>
            {s.error}
          </ThemedText>
        ) : null}
        {s.found && !s.found.length ? (
          <EmptyState icon="people-outline" title="No clubs found" hint="Try the area's name, or start a club yourself." />
        ) : null}
        {s.found?.length ? (
          <Surface level={1} style={[styles.list, styles.gap]}>
            {s.found.map((c) => (
              <ClubRow key={c.clubId} club={c} onPress={() => open(c)} />
            ))}
          </Surface>
        ) : null}

        {mine.data?.length ? (
          <>
            <SectionTitle>Your clubs</SectionTitle>
            <Surface level={1} style={styles.list}>
              {mine.data.map((c) => (
                <ClubRow key={c.clubId} club={c} onPress={() => open(c)} />
              ))}
            </Surface>
            {mine.data.some((c) => c.goals && c.myState === 'member') ? (
              <Button label="My goals" variant="secondary" icon="checkbox-outline" onPress={() => router.push('/buddies/goals' as never)} style={styles.gap} />
            ) : null}
          </>
        ) : null}

        <SectionTitle>Start your own</SectionTitle>
        <ThemedText themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {"Start a club for the people you walk with. You'll be the captain."}
        </ThemedText>
        <Button label="Start a club" variant="tonal" icon="add-outline" onPress={() => router.push('/buddies/club/new' as never)} style={styles.gap} />
      </Screen>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  gap: { marginTop: Spacing.three },
});
