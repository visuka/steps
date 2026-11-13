import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { confirm } from '@/components/confirm';
import { Segmented } from '@/components/controls';
import { PremiumCard } from '@/components/premium-gate';
import { RouteMap } from '@/components/route-map';
import { ThemedText } from '@/components/themed-text';
import { Button, type IconName, ListRow, Screen, Snackbar, StatTile, Surface, Why } from '@/components/ui';
import { NumeralMaxScale, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { gpsState } from '@/lib/gps';
import { formatClock, formatDistance, formatDuration, formatPace, formatSteps } from '@/lib/format';
import { MOTION_LABEL_TEXT } from '@/lib/motion';
import { backAtPlace, type Place, type StartSuggestion, suggestStart } from '@/lib/places';
import { paceSecPerKm, type RideEffort } from '@/lib/walk';
import { locationAllowed, preciseLocationAllowed } from '@/location/place';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { usePremium } from '@/state/use-premium';
import { createWalkFeed, liveView, type WalkFeed, type WalkFeedData } from '@/walks/feed';
import { quickFix } from '@/walks/fix';
import { recordingTitle } from '@/walks/labels';
import { rememberStartMode } from '@/walks/places';
import { walkRecorder } from '@/walks/recorder';
import type { RecordingPlace, WalkStartOptions } from '@/walks/recorder.types';
import { finishRecording, strideFor } from '@/walks/save';
import {
  averageSpeedMs,
  climbText,
  currentSpeedMs,
  formatSpeed,
  labelTone,
  LONG_RIDE_MS,
  routeLines,
  splitUnit,
  stairsView,
} from '@/walks/view';

type Phase = 'loading' | 'idle' | 'recording' | 'interrupted' | 'saving';
type Problem = 'denied' | 'failed' | 'save';

const POLL_MS = 3000;

const EFFORT_TEXT: Record<RideEffort, string> = { easy: 'Easy', steady: 'Steady', hard: 'Hard' };

const PROBLEM_TEXT: Record<Problem, string> = {
  denied: 'Location is off for this app',
  failed: 'Couldn’t start. Is location on?',
  save: 'Couldn’t save. Try again.',
};

const BACKGROUND_WHY =
  'Recording carries on with the screen off. Tap the “Recording” notification to come back and finish. Only the time between Start and Finish is recorded.';
const FOREGROUND_WHY =
  'On this device recording pauses if you leave the app, so keep this screen open. Only the time between Start and Finish is recorded.';
const INDOOR_WHY =
  'At a pinned place the walk counts your steps with no GPS, which saves battery. If you go outside it starts mapping your route.';

const EFFORTS: { value: RideEffort; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'steady', label: 'Steady' },
  { value: 'hard', label: 'Hard' },
];

/** The recorder keeps only the pin's shape; the place maths takes a whole Place. */
const asPlace = (p: RecordingPlace): Place => ({ ...p, lastMode: null, updatedAt: 0 });

export default function RecordScreen() {
  const { repo, source, profile, touch } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const premium = usePremium();
  const params = useLocalSearchParams<{ start?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [walkId, setWalkId] = useState<number | null>(null);
  const feed = useRef<WalkFeed | null>(null);
  const [data, setData] = useState<WalkFeedData | null>(null);
  const [polledAt, setPolledAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [strideM, setStrideM] = useState<number | null>(null);
  const [barometer, setBarometer] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [rough, setRough] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [backDismissed, setBackDismissed] = useState(false);
  const [longRideOk, setLongRideOk] = useState(false);

  // Before starting.
  const [activity, setActivity] = useState<'walk' | 'ride'>(params.start === 'walk' || !params.start ? 'walk' : 'ride');
  const [rideIndoor, setRideIndoor] = useState(params.start === 'indoor-ride');
  const [effort, setEffort] = useState<RideEffort>('steady');
  const [suggestion, setSuggestion] = useState<StartSuggestion | null>(null);

  const wasIndoor = useRef<boolean | null>(null);
  const switchedByPerson = useRef(false);

  const poll = useCallback(async () => {
    if (!feed.current) return;
    const next = await feed.current.poll();
    setData(next);
    setPolledAt(Date.now());
  }, []);

  const begin = useCallback(
    async (id: number) => {
      setWalkId(id);
      feed.current = createWalkFeed(walkRecorder, id);
      await poll();
    },
    [poll],
  );

  // Pick up a recording already going (the app was closed mid-walk), else get ready to start.
  useEffect(() => {
    let live = true;
    strideFor(repo, profile).then((s) => live && setStrideM(s), () => live && setStrideM(0.7));
    walkRecorder.hasBarometer().then((b) => live && setBarometer(b));
    (async () => {
      const id = await walkRecorder.active();
      if (!live) return;
      if (id) {
        await begin(id);
        setRough(!(await preciseLocationAllowed()));
        if (live) setPhase((await walkRecorder.isRecording()) ? 'recording' : 'interrupted');
        return;
      }
      setPhase('idle');
      // Offer an indoor walk at a pin: one quick fix, only when location is already allowed.
      const places = await repo.getPlaces().catch(() => [] as Place[]);
      if (!places.length) return live ? setSuggestion({ kind: 'no-pins' }) : undefined;
      if (!(await locationAllowed())) return live ? setSuggestion({ kind: 'none' }) : undefined;
      const [fix, precise] = await Promise.all([quickFix(), preciseLocationAllowed()]);
      if (live) setSuggestion(suggestStart(fix, places, precise));
    })();
    return () => {
      live = false;
    };
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const timer = setInterval(async () => {
      await poll();
      if (!(await walkRecorder.isRecording())) setPhase('interrupted');
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(timer);
    };
  }, [phase, poll]);

  const live = useMemo(
    () => (data && strideM !== null ? liveView(data, profile, strideM, polledAt) : null),
    [data, profile, strideM, polledAt],
  );
  const mode = data?.mode ?? null;

  // "You left Home": the recorder switched to outdoors on its own.
  useEffect(() => {
    if (!mode) return;
    if (wasIndoor.current === true && !mode.indoorNow && !switchedByPerson.current && mode.place) {
      setMessage(`You left ${mode.place.name}, so we're mapping your route.`);
    }
    if (wasIndoor.current !== mode.indoorNow) setBackDismissed(false);
    wasIndoor.current = mode.indoorNow;
    switchedByPerson.current = false;
  }, [mode]);

  const start = async (opts: WalkStartOptions, remember?: { place: Place; mode: 'indoor' | 'outside' }) => {
    setProblem(null);
    try {
      const id = await walkRecorder.start(opts);
      if (id === null) return setProblem('denied');
      if (remember) rememberStartMode(repo, remember.place, remember.mode).catch(() => undefined);
      const indoorRide = opts.activity === 'ride' && opts.indoor;
      setRough(!indoorRide && !(await preciseLocationAllowed()));
      await begin(id);
      setNow(Date.now());
      setPhase('recording');
    } catch {
      setProblem('failed');
    }
  };

  // The stored mode wins on the native side; passing it keeps an indoor ride from asking for location.
  const carryOn = () =>
    start({
      activity: mode?.activity ?? 'walk',
      indoor: mode?.indoorNow ?? false,
      place: mode?.place ?? null,
      effort: mode?.effort ?? null,
    });

  const finish = async () => {
    if (walkId === null) return;
    const interrupted = phase === 'interrupted';
    setPhase('saving');
    setProblem(null);
    try {
      const walk = await finishRecording({ repo, source, profile, recorder: walkRecorder, walkId, interrupted });
      touch();
      // Saved either way; without premium there's no walk page to show it on.
      if (premium.isLocked(SCREEN_FEATURES['walk/[id]'])) router.back();
      else router.replace({ pathname: '/walk/[id]', params: { id: walk.id } });
    } catch {
      // The recording is still on the phone: nothing is lost, try again.
      setProblem('save');
      setPhase('interrupted');
    }
  };

  const discard = () =>
    confirm(
      'Discard this recording?',
      'What was recorded so far will be deleted.',
      async () => {
        if (walkId !== null) {
          await walkRecorder.stop();
          await walkRecorder.discard(walkId);
        }
        router.back();
      },
      'Discard',
    );

  const setIndoor = async (indoor: boolean) => {
    switchedByPerson.current = true;
    await walkRecorder.setIndoor(indoor);
    await poll();
  };

  const dismissMessage = useCallback(() => setMessage(null), []);
  const whyText = walkRecorder.recordsInBackground ? BACKGROUND_WHY : FOREGROUND_WHY;

  // ── before starting ──
  if (phase === 'idle' || phase === 'loading') {
    // Starting is premium. One already going (started with premium) can always be finished below.
    if (premium.isLocked(SCREEN_FEATURES['walk/record'])) {
      return (
        <Screen title="Record" onBack={() => router.back()}>
          {phase === 'idle' ? <PremiumCard /> : null}
        </Screen>
      );
    }
    const ready = phase === 'idle';
    return (
      <Screen title="Record" onBack={() => router.back()}>
        <Segmented
          options={[
            { value: 'walk', label: 'Walk or run' },
            { value: 'ride', label: 'Cycle' },
          ]}
          value={activity}
          onChange={setActivity}
        />

        {activity === 'walk' ? (
          <WalkStart suggestion={suggestion} ready={ready} onStart={start} onPlaces={() => router.push('/walk/places')} />
        ) : (
          <View style={styles.group}>
            <Segmented
              options={[
                { value: 'outside', label: 'Outside' },
                { value: 'indoor', label: 'Indoor bike' },
              ]}
              value={rideIndoor ? 'indoor' : 'outside'}
              onChange={(v) => setRideIndoor(v === 'indoor')}
            />
            {rideIndoor ? (
              <>
                <ThemedText type="labelLarge">Effort</ThemedText>
                <Segmented options={EFFORTS} value={effort} onChange={setEffort} />
              </>
            ) : null}
            <Button
              label="Start ride"
              icon="play"
              disabled={!ready}
              onPress={() => start({ activity: 'ride', indoor: rideIndoor, effort: rideIndoor ? effort : null })}
            />
          </View>
        )}

        {problem ? <ProblemLine problem={problem} /> : null}

        <View style={styles.hint}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.flex}>
            {walkRecorder.recordsInBackground ? 'Keeps recording with the screen off' : 'Keep this screen open'}
          </ThemedText>
          <Why title="Recording" text={whyText} />
        </View>
      </Screen>
    );
  }

  // ── recording, stopped or saving ──
  const ride = mode?.activity === 'ride';
  const indoorNow = !!mode?.indoorNow;
  const indoorRide = ride && !!mode?.indoor;
  const endT = phase === 'recording' ? now : (mode?.lastAliveAt ?? polledAt);
  const elapsedS = walkId ? Math.max(0, (endT - walkId) / 1000) : 0;
  const w = live?.walk;
  const gps = live ? gpsState(live.last?.track ?? null, polledAt, indoorNow || indoorRide) : 'off';
  const finding = phase === 'recording' && !indoorNow && !indoorRide && (gps === 'finding' || !data?.points.length);
  const hasSteps = !ride && !!data?.steps.length && w?.steps != null;
  const stairs = barometer && w && !ride ? stairsView(w) : null;
  const climb = barometer && w && (ride || w.climbM) ? climbText(w.climbM) : null;
  const lines = live ? routeLines(live.points, live.parts, w?.stretches) : [];
  const backAt =
    phase === 'recording' &&
    !ride &&
    !indoorNow &&
    !!mode?.place &&
    !backDismissed &&
    !!data &&
    backAtPlace(data.points, asPlace(mode.place), polledAt);
  const longRide = ride && phase === 'recording' && !longRideOk && now - (walkId ?? now) > LONG_RIDE_MS;
  const what = ride ? 'ride' : 'walk';

  const tile = (label: string, text: string, icon: IconName, note?: string) => {
    const [value, unit] = splitUnit(text);
    return <StatTile key={label} label={label} value={value} unit={unit} icon={icon} note={note} />;
  };

  const tiles = !w
    ? []
    : indoorRide
      ? [
          tile('Active kcal', formatSteps(w.activeKcal), 'flame-outline', 'Estimated'),
          ...(mode?.effort ? [tile('Effort', EFFORT_TEXT[mode.effort], 'pulse-outline')] : []),
        ]
      : ride
        ? [
            tile('Distance', formatDistance(w.distanceM, profile.units), 'navigate-outline'),
            tile('Speed', formatSpeed(currentSpeedMs(data?.points ?? [], polledAt), profile.units), 'speedometer-outline'),
            tile('Avg speed', formatSpeed(averageSpeedMs(w.distanceM, w.movingS), profile.units), 'analytics-outline'),
            tile('Active kcal', formatSteps(w.activeKcal), 'flame-outline', 'Estimated'),
          ]
        : [
            tile('Distance', formatDistance(w.distanceM, profile.units), 'navigate-outline', indoorNow ? 'From steps' : undefined),
            ...(hasSteps ? [tile('Steps', formatSteps(w.steps ?? 0), 'footsteps-outline')] : []),
            tile('Pace', formatPace(paceSecPerKm(w.distanceM, w.movingS), profile.units), 'speedometer-outline'),
            tile('Active kcal', formatSteps(w.activeKcal), 'flame-outline', 'Estimated'),
          ];

  const title = phase === 'interrupted' ? 'Recording stopped' : recordingTitle(mode);
  const labelText = live?.label ? MOTION_LABEL_TEXT[live.label] : null;
  const dot = live?.label ? theme[labelTone(live.label)] : theme.outline;

  return (
    <Screen
      title={title}
      onBack={() => router.back()}
      overlay={<Snackbar message={message} onDismiss={dismissMessage} />}>
      <View style={styles.hero} accessible accessibilityLabel={`Time ${formatDuration(elapsedS)}${labelText ? `, ${labelText}` : ''}`}>
        <ThemedText type="numeralHero" maxFontSizeMultiplier={NumeralMaxScale} style={styles.clock}>
          {formatClock(elapsedS)}
        </ThemedText>
        {(labelText && phase === 'recording') || finding || (gps === 'weak' && phase === 'recording') ? (
        <View style={styles.pills}>
          {labelText && phase === 'recording' ? (
            <View style={[styles.pill, { backgroundColor: theme.surfaceContainerHigh }]}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <ThemedText type="labelLarge">{labelText}</ThemedText>
            </View>
          ) : null}
          {finding ? (
            <View style={[styles.pill, { backgroundColor: theme.surfaceContainerHigh }]}>
              <ActivityIndicator size="small" color={theme.onSurfaceVariant} />
              <ThemedText type="labelLarge">Finding GPS…</ThemedText>
            </View>
          ) : gps === 'weak' && phase === 'recording' ? (
            <View style={[styles.pill, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Ionicons name="warning-outline" size={16} color={theme.near} />
              <ThemedText type="labelLarge">GPS weak</ThemedText>
            </View>
          ) : null}
        </View>
        ) : null}
      </View>

      {longRide ? (
        <Surface level={3} style={styles.panel}>
          <ThemedText type="titleMedium">Still cycling?</ThemedText>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            {formatDuration(elapsedS)} so far
          </ThemedText>
          <View style={styles.pair}>
            <Button label="Finish ride" style={styles.flex} onPress={finish} />
            <Button label="Carry on" variant="tonal" style={styles.flex} onPress={() => setLongRideOk(true)} />
          </View>
        </Surface>
      ) : null}

      <View style={styles.tiles}>{tiles}</View>

      {stairs ? (
        <Surface level={2} style={styles.stairs}>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            Stairs
          </ThemedText>
          <Count icon="arrow-up" value={stairs.up} label="floors up" />
          <Count icon="arrow-down" value={stairs.down} label="floors down" />
          {stairs.liftUp || stairs.liftDown ? (
            <>
              <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
                Lift
              </ThemedText>
              <Count icon="swap-vertical" value={stairs.liftUp + stairs.liftDown} label="floors by lift" />
            </>
          ) : null}
        </Surface>
      ) : null}
      {climb ? (
        <Surface level={2} style={styles.stairs}>
          <Ionicons name="trending-up" size={20} color={theme.onSurfaceVariant} />
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            Climb
          </ThemedText>
          <ThemedText type="numeralSmall">{climb}</ThemedText>
        </Surface>
      ) : null}

      {indoorNow && !ride ? (
        <Surface level={3} style={styles.panel}>
          <View style={styles.row}>
            <Ionicons name="home-outline" size={20} color={theme.onSurface} />
            <ThemedText type="titleSmall" style={styles.flex}>
              {mode?.place ? `Indoor at ${mode.place.name}` : 'Indoor'} · steps only
            </ThemedText>
            <Why title="Indoor walk" text={INDOOR_WHY} />
          </View>
          {phase === 'recording' ? (
            <Button label="I'm outside now" variant="tonal" icon="sunny-outline" onPress={() => setIndoor(false)} />
          ) : null}
        </Surface>
      ) : null}

      {backAt && mode?.place ? (
        <Surface level={3} style={styles.panel}>
          <ThemedText type="titleMedium">Back at {mode.place.name}?</ThemedText>
          <View style={styles.pair}>
            <Button label="I'm back inside" variant="tonal" style={styles.flex} onPress={() => setIndoor(true)} />
            <Button label="Not now" variant="text" style={styles.flex} onPress={() => setBackDismissed(true)} />
          </View>
        </Surface>
      ) : null}

      {!indoorNow && !indoorRide && lines.length ? (
        <RouteMap lines={lines} height={240} follow={phase === 'recording'} />
      ) : null}

      {rough && !indoorRide ? (
        <View style={styles.hint}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.flex}>
            Precise location is off: the route will be rough
          </ThemedText>
          <Button label="Settings" variant="text" compact onPress={() => Linking.openSettings()} />
        </View>
      ) : null}

      {problem ? <ProblemLine problem={problem} /> : null}

      {phase === 'interrupted' ? (
        <Surface level={3} style={styles.panel}>
          <ThemedText type="titleMedium">The phone stopped the recording</ThemedText>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            Save what was recorded, or carry on.
          </ThemedText>
          <Button label={`Save ${what}`} onPress={finish} />
          <Button label="Carry on" variant="tonal" onPress={carryOn} />
        </Surface>
      ) : (
        <Button label={`Finish ${what}`} icon="stop" loading={phase === 'saving'} onPress={finish} />
      )}
      {phase !== 'saving' ? <Button label="Discard" variant="text" danger onPress={discard} /> : null}

      <View style={styles.hint}>
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.flex}>
          {walkRecorder.recordsInBackground ? 'Keeps recording with the screen off' : 'Keep this screen open'}
        </ThemedText>
        <Why title="Recording" text={whyText} />
      </View>
    </Screen>
  );
}

/** Before a walk: an indoor walk at a pin, or a plain start. */
function WalkStart({
  suggestion,
  ready,
  onStart,
  onPlaces,
}: {
  suggestion: StartSuggestion | null;
  ready: boolean;
  onStart: (opts: WalkStartOptions, remember?: { place: Place; mode: 'indoor' | 'outside' }) => void;
  onPlaces: () => void;
}) {
  const theme = useTheme();
  if (suggestion?.kind === 'at' || suggestion?.kind === 'unsure') {
    const place = suggestion.place;
    const pin = { id: place.id, name: place.name, lat: place.lat, lon: place.lon, radiusM: place.radiusM };
    const indoorFirst = suggestion.kind === 'at' ? suggestion.first === 'indoor' : false;
    const indoor = (
      <Button
        key="in"
        label={suggestion.kind === 'unsure' ? 'Yes, indoor walk' : 'Indoor walk'}
        icon="home-outline"
        variant={indoorFirst ? 'filled' : 'tonal'}
        disabled={!ready}
        style={styles.flex}
        onPress={() => onStart({ activity: 'walk', indoor: true, place: pin }, { place, mode: 'indoor' })}
      />
    );
    const outside = (
      <Button
        key="out"
        label={suggestion.kind === 'unsure' ? 'No, walk outside' : 'Walk outside'}
        icon="sunny-outline"
        variant={indoorFirst ? 'tonal' : 'filled'}
        disabled={!ready}
        style={styles.flex}
        onPress={() => onStart({ activity: 'walk', indoor: false }, { place, mode: 'outside' })}
      />
    );
    return (
      <Surface level={2} style={styles.panel}>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={20} color={theme.onSurface} />
          <ThemedText type="titleMedium" style={styles.flex}>
            {suggestion.kind === 'at' ? `You're at ${place.name}` : `Are you at ${place.name}?`}
          </ThemedText>
          <Why title="Indoor walk" text={INDOOR_WHY} />
        </View>
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          Indoor walk: steps only, no GPS
        </ThemedText>
        <View style={styles.pair}>{indoorFirst ? [indoor, outside] : [outside, indoor]}</View>
      </Surface>
    );
  }
  return (
    <View style={styles.group}>
      <Button label="Start walk" icon="play" disabled={!ready} onPress={() => onStart({ activity: 'walk', indoor: false })} />
      {suggestion?.kind === 'no-pins' ? (
        <Surface level={1} style={styles.clip}>
          <ListRow icon="location-outline" title="Pin places you walk indoors" supporting="Home, office, gym" chevron onPress={onPlaces} />
        </Surface>
      ) : null}
    </View>
  );
}

function Count({ icon, value, label }: { icon: 'arrow-up' | 'arrow-down' | 'swap-vertical'; value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.count} accessible accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={18} color={theme.onSurface} />
      <ThemedText type="numeralSmall">{value}</ThemedText>
    </View>
  );
}

function ProblemLine({ problem }: { problem: Problem }) {
  const theme = useTheme();
  return (
    <View style={styles.hint} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
      <ThemedText type="bodyMedium" style={styles.flex}>
        {PROBLEM_TEXT[problem]}
      </ThemedText>
      {problem === 'denied' ? (
        <Button label="Settings" variant="text" compact onPress={() => Linking.openSettings()} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: 'hidden' },
  group: { gap: Spacing.three },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  clock: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two },
  pill: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stairs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 56,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  panel: { padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
