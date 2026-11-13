import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { RouteSketch } from '@/components/route-sketch';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, type IconName, ListRow, Screen, SectionHeader, StatTile, Surface } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { Walk } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration } from '@/lib/format';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { walksCount, walkTitle } from '@/walks/labels';
import { walkRecorder } from '@/walks/recorder';
import { distanceTag, historyLine, historyValue, placesLine, type RouteLine, routeLines } from '@/walks/view';

const LIST_LIMIT = 50;
/** Route drawings are only loaded for the first few rows. */
const SKETCH_LIMIT = 20;
const SKETCH = 48;

/** What the record screen starts as (it can still switch). */
type StartKind = 'walk' | 'ride' | 'indoor-ride';

const STARTS: { kind: StartKind; label: string; icon: IconName }[] = [
  { kind: 'walk', label: 'Walk or run', icon: 'walk' },
  { kind: 'ride', label: 'Cycle', icon: 'bicycle' },
  { kind: 'indoor-ride', label: 'Indoor bike', icon: 'speedometer-outline' },
];

/** Activity: start a walk or a ride, your places, and everything recorded. The old /walks address lands here. */
export default function ActivityTab() {
  return (
    <PremiumGate feature={SCREEN_FEATURES.walks} title="Activity">
      <ActivityScreen />
    </PremiumGate>
  );
}

function ActivityScreen() {
  const { repo, profile, dataVersion } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [walks, setWalks] = useState<Walk[] | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteLine[]>>({});
  const [places, setPlaces] = useState<string[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [monthAgo, setMonthAgo] = useState(0);

  useFocusEffect(
    useCallback(() => {
      walkRecorder.active().then(setActive);
      // Places can change on their own screen without a data bump.
      repo.getPlaces().then((list) => setPlaces(list.map((p) => p.name)), () => setPlaces([]));
    }, [repo]),
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const list = await repo.getWalks(LIST_LIMIT);
      if (!live) return;
      setWalks(list);
      setMonthAgo(Date.now() - 30 * 86_400_000);
      const loaded: Record<string, RouteLine[]> = {};
      for (const w of list.slice(0, SKETCH_LIMIT)) {
        const [found, parts] = await Promise.all([repo.getWalk(w.id), repo.getWalkParts(w.id)]);
        // Drawn as the walk page draws it: parts left out stay dashed, never a straight shortcut.
        loaded[w.id] = routeLines(found?.points ?? [], parts, w.stretches);
      }
      if (live) setRoutes(loaded);
    })();
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  const recent = (walks ?? []).filter((w) => w.startedAt >= monthAgo);
  const recentDistance = recent.reduce((s, w) => s + w.distanceM, 0);
  const recentTime = recent.reduce((s, w) => s + (w.movingS || (w.endedAt - w.startedAt) / 1000), 0);

  const start = (kind: StartKind) => router.push({ pathname: '/walk/record', params: { start: kind } });
  const open = (w: Walk) => router.push({ pathname: '/walk/[id]', params: { id: w.id } });

  return (
    <Screen title="Activity">
      {active ? (
        <Surface level={3} style={styles.clip}>
          <ListRow
            icon="radio-button-on"
            title="Recording now"
            supporting="Open to see it or finish"
            chevron
            onPress={() => router.push('/walk/record')}
          />
        </Surface>
      ) : (
        <View style={styles.starts}>
          {STARTS.map((s) => (
            <Pressable
              key={s.kind}
              onPress={() => start(s.kind)}
              accessibilityRole="button"
              accessibilityLabel={`Start: ${s.label}`}
              android_ripple={{ color: theme.outlineVariant, foreground: true }}
              style={({ pressed }) => [
                styles.start,
                { backgroundColor: pressed ? theme.surfaceContainerHighest : theme.surfaceContainerHigh },
              ]}>
              <Ionicons name={s.icon} size={32} color={theme.onSurface} />
              <ThemedText type="labelLarge" style={styles.center} numberOfLines={2}>
                {s.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <Surface level={1} style={styles.clip}>
        <ListRow
          icon="location-outline"
          title="Places"
          supporting={placesLine(places)}
          chevron
          onPress={() => router.push('/walk/places')}
        />
      </Surface>

      {recent.length ? (
        <>
          <SectionHeader title="Last 30 days" />
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.count}>
            {walksCount(recent)}
          </ThemedText>
          <View style={styles.summary}>
            <StatTile label="Distance" value={formatDistance(recentDistance, profile.units)} icon="navigate-outline" />
            <StatTile label="Time" value={formatDuration(recentTime)} icon="timer-outline" />
          </View>
        </>
      ) : null}

      {walks && walks.length === 0 ? (
        <EmptyState icon="walk-outline" title="Nothing recorded yet" hint="Your route, pace and calories show here." />
      ) : walks ? (
        <>
          <SectionHeader title="Recent" />
          <Surface level={1} style={[styles.clip, styles.list]}>
            {walks.map((w) => {
              const ride = w.activity === 'ride';
              const title = walkTitle(w.startedAt, w.activity ?? 'walk');
              const line = historyLine(w);
              const value = historyValue(w, profile.units);
              const tag = distanceTag(w.distanceFrom);
              return (
                <ListRow
                  key={w.id}
                  leading={
                    <View style={styles.leading}>
                      <Surface level={3} radius={Radius.sm} style={styles.sketch}>
                        {routes[w.id]?.length ? (
                          <RouteSketch lines={routes[w.id]} width={SKETCH} height={SKETCH} />
                        ) : null}
                      </Surface>
                      <View style={[styles.badge, { backgroundColor: theme.surfaceContainerHighest, borderColor: theme.surfaceContainerLow }]}>
                        <Ionicons name={ride ? 'bicycle' : 'walk'} size={14} color={theme.onSurface} />
                      </View>
                    </View>
                  }
                  title={title}
                  supporting={line}
                  trailing={
                    <View style={styles.trailing}>
                      <ThemedText type="labelLarge">{value}</ThemedText>
                      {tag ? (
                        <ThemedText type="labelSmall" themeColor="onSurfaceVariant">
                          {tag}
                        </ThemedText>
                      ) : null}
                    </View>
                  }
                  onPress={() => open(w)}
                  accessibilityLabel={`${title}, ${line}, ${value}${tag ? `, ${tag}` : ''}`}
                />
              );
            })}
          </Surface>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  starts: { flexDirection: 'row', gap: Spacing.two },
  start: {
    flex: 1,
    minHeight: 96,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    overflow: 'hidden',
  },
  center: { textAlign: 'center' },
  clip: { overflow: 'hidden' },
  count: { marginTop: -Spacing.two },
  summary: { flexDirection: 'row', gap: Spacing.two },
  list: { paddingVertical: Spacing.one },
  leading: { width: SKETCH + 4, height: SKETCH + 4 },
  sketch: { width: SKETCH, height: SKETCH, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: { alignItems: 'flex-end', gap: Spacing.half },
});
