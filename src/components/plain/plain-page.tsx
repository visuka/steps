import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avatarInitial } from '@/components/today/model';
import { MaxContentWidth } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';
import { cleanName } from '@/data/profile';
import { useApp } from '@/state/app-state';

import { useFootInset } from './part-bar';
import { PlainGround, TopRow } from './plain-kit';
import { PLAIN, PLAIN_SIZE } from './plain-theme';

const S = scaled;

/**
 * A part's page in the plain look (Nutrition or Buddies): the grey ground, the
 * top row (calendar, avatar), then the tiles 9 apart, scrolling when they don't
 * fit; the part bar sits under it. `overlay` sits over everything (a snackbar).
 */
export function PlainPage({
  children,
  overlay,
  onRefresh,
  refreshing = false,
  gap = PLAIN_SIZE.gap,
}: {
  children: ReactNode;
  overlay?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  gap?: number;
}) {
  const insets = useSafeAreaInsets();
  const foot = useFootInset();
  const router = useRouter();
  const { profile } = useApp();
  const initial = avatarInitial(cleanName(profile.name));
  return (
    <View style={styles.screen}>
      <PlainGround />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + PLAIN_SIZE.topUnderStatus, paddingBottom: foot, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PLAIN.main]} tintColor={PLAIN.main} progressViewOffset={insets.top} />
          ) : undefined
        }>
        <View style={[styles.column, { gap: S(gap) }]}>
          <TopRow
            initial={initial}
            onCalendar={() => router.push({ pathname: '/detail/steps', params: {} } as unknown as Href)}
          />
          {children}
        </View>
      </ScrollView>
      <View pointerEvents="none" style={[styles.statusInset, { height: insets.top }]} />
      {overlay ? (
        <View pointerEvents="box-none" style={[styles.overlay, { bottom: foot + 16 }]}>
          {overlay}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PLAIN.ground.top },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1, paddingHorizontal: S(PLAIN_SIZE.gutter) },
  statusInset: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: PLAIN.ground.top },
  overlay: { position: 'absolute', left: S(PLAIN_SIZE.gutter), right: S(PLAIN_SIZE.gutter) },
});
