import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { confirm } from '@/components/confirm';
import { Button } from '@/components/controls';
import { RouteMap } from '@/components/route-map';
import { Screen } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Walk } from '@/data/types';
import { formatDistance, formatDuration, formatPace, formatSteps, formatTemp } from '@/lib/format';
import { paceSecPerKm, type WalkPoint } from '@/lib/walk';
import { useApp } from '@/state/app-state';
import { walkTitle, walkWhen } from '@/walks/labels';
import { refreshWalkSteps } from '@/walks/save';
import { CONDITION_ICON, CONDITION_LABEL } from '@/weather/met';

export default function WalkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, source, profile, touch } = useApp();
  const router = useRouter();
  const [walk, setWalk] = useState<Walk | null>(null);
  const [points, setPoints] = useState<WalkPoint[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = await repo.getWalk(id);
      if (!live) return;
      if (!found) {
        setMissing(true);
        return;
      }
      setWalk(found.walk);
      setPoints(found.points);
      const updated = await refreshWalkSteps(repo, source, found.walk);
      if (live && updated !== found.walk) setWalk(updated);
    })();
    return () => {
      live = false;
    };
  }, [repo, source, id]);

  const remove = () =>
    confirm('Delete this walk?', 'Its route and stats will be removed. Your step counts stay.', async () => {
      await repo.deleteWalk(id);
      touch();
      router.back();
    });

  if (!walk) {
    return (
      <Screen title="Walk" onBack={() => router.back()}>
        <ThemedText themeColor="textSecondary">{missing ? 'This walk was deleted.' : 'Loading…'}</ThemedText>
      </Screen>
    );
  }

  const durationS = walk.movingS || (walk.endedAt - walk.startedAt) / 1000;
  return (
    <Screen title={walkTitle(walk.startedAt)} subtitle={walkWhen(walk.startedAt)} onBack={() => router.back()}>
      {points.length >= 2 ? (
        <RouteMap points={points} height={300} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No route for this walk (GPS had no fix), so distance comes from steps.
        </ThemedText>
      )}

      <View style={styles.tiles}>
        <StatTile icon="navigate-outline" label="Distance" value={formatDistance(walk.distanceM, profile.units)} />
        <StatTile icon="timer-outline" label="Moving time" value={formatDuration(durationS)} />
        <StatTile
          icon="speedometer-outline"
          label="Pace"
          value={formatPace(paceSecPerKm(walk.distanceM, walk.movingS), profile.units)}
        />
        <StatTile icon="footsteps-outline" label="Steps" value={walk.steps === null ? '—' : formatSteps(walk.steps)} />
        <StatTile icon="flame-outline" label="Active kcal" value={formatSteps(walk.activeKcal)} note="Estimated from pace" />
      </View>

      {walk.startPlace || walk.weather ? (
        <Card title="Context">
          {walk.startPlace ? <ThemedText>Started around {walk.startPlace}</ThemedText> : null}
          {walk.weather ? (
            <ThemedText>
              {CONDITION_ICON[walk.weather.condition]} {CONDITION_LABEL[walk.weather.condition]},{' '}
              {formatTemp(walk.weather.tempC, profile.units)}
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      <Button kind="danger" label="Delete walk" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
