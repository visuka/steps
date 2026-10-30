import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { confirm } from '@/components/confirm';
import { Button } from '@/components/controls';
import { RouteMap } from '@/components/route-map';
import { Screen } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, formatDistance, formatPace, formatSteps } from '@/lib/format';
import { cleanPoints, paceSecPerKm, walkActiveKcal, type WalkPoint, walkStats } from '@/lib/walk';
import { preciseLocationAllowed } from '@/location/place';
import { useApp } from '@/state/app-state';
import { walkRecorder } from '@/walks/recorder';
import { saveWalk } from '@/walks/save';

type Phase = 'loading' | 'idle' | 'recording' | 'interrupted' | 'saving';

const POLL_MS = 3000;

export default function RecordWalkScreen() {
  const { repo, source, profile, touch } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [walkId, setWalkId] = useState<number | null>(null);
  const [points, setPoints] = useState<WalkPoint[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [rough, setRough] = useState(false);
  const lastT = useRef(0);

  const loadPoints = async (id: number, fresh: boolean) => {
    const more = await walkRecorder.points(id, fresh ? 0 : lastT.current);
    if (more.length) lastT.current = more[more.length - 1].t;
    setPoints((p) => (fresh ? more : [...p, ...more]));
  };

  // Pick up a walk already in progress, e.g. after the app was closed mid-walk.
  useEffect(() => {
    (async () => {
      const id = await walkRecorder.active();
      if (!id) {
        setPhase('idle');
        return;
      }
      setWalkId(id);
      await loadPoints(id, true);
      setRough(!(await preciseLocationAllowed()));
      setPhase((await walkRecorder.isRecording()) ? 'recording' : 'interrupted');
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'recording' || walkId === null) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      await loadPoints(walkId, false);
      if (!(await walkRecorder.isRecording())) setPhase('interrupted');
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [phase, walkId]);

  const start = async () => {
    setNotice(null);
    try {
      const id = await walkRecorder.start();
      if (id === null) {
        setNotice('Steps needs your location to record the route. Allow it while using the app, then try again.');
        return;
      }
      setWalkId(id);
      await loadPoints(id, true);
      setRough(!(await preciseLocationAllowed()));
      setNow(Date.now());
      setPhase('recording');
    } catch {
      setNotice("Couldn't start recording. Check that location is turned on.");
    }
  };

  const finish = async () => {
    if (walkId === null) return;
    const wasInterrupted = phase === 'interrupted';
    setPhase('saving');
    await walkRecorder.stop();
    const all = await walkRecorder.points(walkId, 0);
    // An interrupted walk ended at its last fix, not now.
    const endedAt = wasInterrupted && all.length ? all[all.length - 1].t : Date.now();
    const walk = await saveWalk({ repo, source, profile, startedAt: walkId, endedAt, points: all });
    await walkRecorder.discard(walkId);
    touch();
    router.replace({ pathname: '/walk/[id]', params: { id: walk.id } });
  };

  const discard = () =>
    confirm('Discard this walk?', 'The route recorded so far will be deleted.', async () => {
      if (walkId !== null) {
        await walkRecorder.stop();
        await walkRecorder.discard(walkId);
      }
      router.back();
    }, 'Discard');

  const stats = walkStats(cleanPoints(points));
  const elapsedS = walkId ? ((phase === 'recording' ? now : (points[points.length - 1]?.t ?? now)) - walkId) / 1000 : 0;

  if (phase === 'idle' || phase === 'loading') {
    return (
      <Screen title="Record a walk" onBack={() => router.back()}>
        <Card>
          <ThemedText>
            Steps records your route on a map, with distance, pace, steps, calories and the weather.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {walkRecorder.recordsInBackground
              ? 'It keeps recording with the screen off. Tap the "Recording your walk" notification to come back and stop.'
              : 'Keep Steps open on screen while you walk; recording pauses if you leave the app.'}{' '}
            Your route is recorded only between Start and Finish.
          </ThemedText>
          <Button label="Start walk" onPress={start} disabled={phase === 'loading'} />
          {notice ? (
            <>
              <ThemedText type="small" style={{ color: theme.danger }}>
                {notice}
              </ThemedText>
              <Button kind="secondary" label="Open app settings" onPress={() => Linking.openSettings()} />
            </>
          ) : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={phase === 'interrupted' ? 'Walk paused' : 'Walking'} onBack={() => router.back()}>
      <ThemedText style={styles.clock}>{formatClock(elapsedS)}</ThemedText>
      <View style={styles.tiles}>
        <StatTile icon="navigate-outline" label="Distance" value={formatDistance(stats.distanceM, profile.units)} />
        <StatTile
          icon="speedometer-outline"
          label="Pace"
          value={formatPace(paceSecPerKm(stats.distanceM, stats.movingS), profile.units)}
        />
        <StatTile
          icon="flame-outline"
          label="Active kcal"
          value={formatSteps(walkActiveKcal(stats.segments, profile.weightKg))}
          note="Estimated"
        />
      </View>

      <RouteMap points={cleanPoints(points)} height={280} follow={phase === 'recording'} />
      {points.length === 0 && phase === 'recording' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Waiting for GPS. It&apos;s quickest outdoors with a clear view of the sky.
        </ThemedText>
      ) : null}
      {rough ? (
        <ThemedText type="small" themeColor="textSecondary">
          Precise location is off, so the route will be rough. Turn on &quot;Use precise location&quot; for Steps in
          system settings.
        </ThemedText>
      ) : null}

      {phase === 'interrupted' ? (
        <Card>
          <ThemedText>Recording stopped, probably because the phone closed the app. Save what was recorded, or carry on.</ThemedText>
          <Button label="Save walk" onPress={finish} />
          <Button kind="secondary" label="Carry on recording" onPress={start} />
        </Card>
      ) : (
        <Button label={phase === 'saving' ? 'Saving…' : 'Finish walk'} onPress={finish} disabled={phase === 'saving'} />
      )}
      {phase !== 'saving' ? <Button kind="danger" label="Discard" onPress={discard} /> : null}
      {!walkRecorder.recordsInBackground ? (
        <ThemedText type="small" themeColor="textSecondary">
          Keep this screen open while you walk.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  clock: { fontSize: 56, lineHeight: 64, fontWeight: 700, fontVariant: ['tabular-nums'], textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
