import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { RouteSketch } from '@/components/route-sketch';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Walk } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration, formatSteps } from '@/lib/format';
import type { WalkPoint } from '@/lib/walk';
import { useApp } from '@/state/app-state';
import { walkTitle, walkWhen } from '@/walks/labels';
import { walkRecorder } from '@/walks/recorder';

const LIST_LIMIT = 50;
/** Route drawings are only loaded for the first few rows. */
const SKETCH_LIMIT = 20;

export default function WalksScreen() {
  const { repo, profile, dataVersion } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [routes, setRoutes] = useState<Record<string, WalkPoint[]>>({});
  const [active, setActive] = useState<number | null>(null);
  const [monthAgo, setMonthAgo] = useState(0);

  useFocusEffect(
    useCallback(() => {
      walkRecorder.active().then(setActive);
    }, []),
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const list = await repo.getWalks(LIST_LIMIT);
      if (!live) return;
      setWalks(list);
      setMonthAgo(Date.now() - 30 * 86_400_000);
      const loaded: Record<string, WalkPoint[]> = {};
      for (const w of list.slice(0, SKETCH_LIMIT)) loaded[w.id] = (await repo.getWalk(w.id))?.points ?? [];
      if (live) setRoutes(loaded);
    })();
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  const recent = walks.filter((w) => w.startedAt >= monthAgo);
  const recentDistance = recent.reduce((s, w) => s + w.distanceM, 0);
  const recentTime = recent.reduce((s, w) => s + w.movingS, 0);

  return (
    <Screen title="Walks">
      <Card>
        <ThemedText themeColor="textSecondary">
          {active
            ? 'A walk is being recorded.'
            : 'Record a walk to see your route on a map, with distance, pace, steps and calories.'}
        </ThemedText>
        <Button label={active ? 'Open walk in progress' : 'Start a walk'} onPress={() => router.push('/walk/record')} />
      </Card>

      {recent.length ? (
        <View style={styles.summary}>
          <Summary label="Walks, 30 days" value={String(recent.length)} />
          <Summary label="Distance" value={formatDistance(recentDistance, profile.units)} />
          <Summary label="Time" value={formatDuration(recentTime)} />
        </View>
      ) : null}

      {walks.length === 0 ? (
        <ThemedText themeColor="textSecondary">Your recorded walks will show here.</ThemedText>
      ) : (
        walks.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => router.push({ pathname: '/walk/[id]', params: { id: w.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${walkTitle(w.startedAt)}, ${walkWhen(w.startedAt)}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <Card style={styles.row}>
              <ThemedView type="backgroundSelected" style={styles.sketch}>
                {routes[w.id]?.length ? <RouteSketch points={routes[w.id]} width={64} height={64} /> : null}
              </ThemedView>
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{walkTitle(w.startedAt)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {walkWhen(w.startedAt)}
                  {w.startPlace ? ` · ${w.startPlace}` : ''}
                </ThemedText>
                <ThemedText type="small">
                  {formatDistance(w.distanceM, profile.units)} · {formatDuration(w.movingS)} · {formatSteps(w.activeKcal)}{' '}
                  kcal
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.summaryCard}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.summaryValue}>{value}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: Spacing.three },
  summaryCard: { flex: 1, gap: Spacing.half },
  summaryValue: { fontSize: 18, lineHeight: 24, fontWeight: 700, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sketch: { width: 64, height: 64, borderRadius: Spacing.three, overflow: 'hidden' },
  rowText: { flex: 1, gap: Spacing.half },
});
