import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppearanceNote } from '@/components/appearance-note';
import { PremiumCard } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Snackbar, Why } from '@/components/ui';
import { distanceOf, heroSpoken, percentOf, untimedNote } from '@/components/today/model';
import { detailRoute, type DetailKind, walkingLine } from '@/components/today/today-actions';
import { TodayClean } from '@/components/today/today-clean';
import { TODAY_LAYOUT } from '@/components/today/today-layout';
import { useActiveWalk } from '@/components/today/use-active-walk';
import { useTodayExtras } from '@/components/today/use-today-extras';
import type { TodayFrameLook, TodayView } from '@/components/today/view';
import { WalkingCard } from '@/components/today/walking-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { LogEntry } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey } from '@/lib/dates';
import { formatSteps, minutesAgo } from '@/lib/format';
import { SUGGESTION_DAYS, suggestGoal } from '@/lib/goals';
import { locationAllowed, requestLocation } from '@/location/place';
import { PARTIAL_NOTE } from '@/nutrition/state';
import { dayKcalTarget } from '@/nutrition/targets';
import { useApp } from '@/state/app-state';
import { useTodayKcal } from '@/state/use-calories';
import { usePremium } from '@/state/use-premium';
import { type AddedGlass, useWaterToday } from '@/state/use-water';

const WEATHER_PROMPT_KEY = 'weatherPromptDismissed';

/**
 * Today: the Clean+ Today (components/today/today-clean.tsx) for every look,
 * handed the same data, taps and premium lock. The first screen is the
 * greeting, week strip, steps hero (with its hour chart) and tiles; the goal
 * suggestion and weather offer follow below (the mood check-in is in Journal; spec 7 ends Today at the tiles). The status bar
 * keeps a strip of the page colour, so nothing scrolls under the clock.
 */
export default function TodayScreen() {
  const { source, profile, today, displaySteps, lastSyncAt, syncing, refresh, updateProfile } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const premium = usePremium();
  const insets = useSafeAreaInsets();
  // today-clean adds the 24 dp under the status bar; the safe-area inset is added here.
  const look: TodayFrameLook = { background: theme.surface, gutter: TODAY_LAYOUT.sideMargin };
  const details = !premium.isLocked('today-details');
  const todayKey = dayKey(new Date());
  const [snack, setSnack] = useState<{ text: string; undo?: LogEntry } | null>(null);
  // Counts each time Today comes into view: food, sleep, the walk and the active walk are read again then.
  const [visits, setVisits] = useState(0);
  const water = useWaterToday(details && !premium.isLocked('body'));
  const kcal = useTodayKcal(visits);
  const extras = useTodayExtras(visits);
  const activeWalk = useActiveWalk(visits);

  useFocusEffect(
    useCallback(() => {
      setVisits((n) => n + 1);
    }, []),
  );

  const showAdded = (a: AddedGlass | null) =>
    setSnack(a ? { text: a.text, undo: a.entry } : { text: "Couldn't save that. Try again." });
  const addGlass = async () => showAdded(await water.add());

  // Only today's row: after midnight the one in memory can still be yesterday's until the next sync.
  const activeKcal = today?.date === todayKey ? today.activeKcal : 0;
  const goal = profile.dailyGoal;
  const steps = displaySteps;
  const pct = percentOf(steps, goal);
  const distance = today ? distanceOf(today.distanceM, profile.units) : null;
  // Only today's row, as with activeKcal.
  const untimedSteps = today?.date === todayKey ? today.untimedSteps : 0;
  const activeMin = today ? (today.activeMin ?? sumOrNull(today.briskMin, today.runMin)) : null;
  const dayBurn = dayKcalTarget(profile, activeKcal, new Date().getFullYear());
  const eatenText = formatSteps(kcal.eaten);
  const ws = water.status;
  const glasses = ws?.progress?.glasses ?? Math.floor(((ws?.waterMl ?? 0) + (ws?.drinksMl ?? 0)) / profile.water.glassMl);
  const glassesOf = ws?.progress && !ws.target?.limit ? ws.progress.glassesTarget : null;
  const syncLine = `${lastSyncAt ? `Updated ${minutesAgo(lastSyncAt)}` : 'Not synced yet'} · ${source.label}`;

  // A tap on a tile or the hero: its detail screen (the Walk tile: its walk). The Water plus circle adds a glass (addGlass).
  const open = (kind: DetailKind) => {
    const target = detailRoute(kind, extras.walk?.id ?? null);
    if (!target) return;
    // /detail/<kind> is not in the typed routes: cast.
    const href = target as unknown as Href;
    if (target.pathname.startsWith('/detail') || target.pathname.startsWith('/walk')) router.push(href);
    else router.navigate(href);
  };

  const view: TodayView = {
    dateLabel: extras.dateLabel,
    name: extras.name,
    initial: extras.initial,
    steps,
    goal,
    pct,
    stepsSpoken: heroSpoken(steps, goal, distance, activeMin, extras.distanceUnit),
    distance,
    distanceUnit: extras.distanceUnit,
    activeMin,
    hourly: extras.hourly,
    nowHour: extras.nowHour,
    details,
    food: {
      text: eatenText,
      target: formatSteps(dayBurn),
      share: dayBurn > 0 ? kcal.eaten / dayBurn : 0,
      partial: kcal.partial,
      spoken: `Food, ${kcal.partial ? 'at least ' : ''}${eatenText} of about ${formatSteps(dayBurn)} kcal${kcal.partial ? `. ${PARTIAL_NOTE}` : ''}`,
    },
    water: {
      glasses,
      of: glassesOf,
      spoken: `Water, ${glasses} ${glasses === 1 ? 'glass' : 'glasses'}${glassesOf ? ` of ${glassesOf}` : ''}`,
    },
    sleep: extras.sleep,
    sleepSpoken: extras.sleepSpoken,
    walk: extras.walk,
    walkSpoken: extras.walkSpoken,
    week: extras.week,
    on: {
      food: () => open('food'),
      water: () => open('water'),
      addGlass,
      sleep: () => open('sleep'),
      walk: () => open('walk'),
      steps: () => open('steps'),
      // The locked tiles have no screen of their own: the premium card below them is the target.
      premium: () => scroll.current?.scrollToEnd({ animated: true }),
      profile: () => router.navigate('/you'),
      // The Journal takes no day yet, so a tapped day opens the Journal itself.
      calendar: () => router.navigate('/journal'),
    },
    slots: {
      walking: activeWalk ? (
        <WalkingCard
          line={walkingLine(activeWalk.elapsedS, activeWalk.distanceM, profile.units)}
          onPress={() => router.push('/walk/record')}
        />
      ) : null,
      note: (style) => <AppearanceNote style={style} />,
      below: (
        <BelowTheFold
          weatherDay={todayKey}
          untimed={untimedNote(untimedSteps)}
          onGoal={(dailyGoal) => updateProfile({ dailyGoal })}
          onLocation={refresh}
        />
      ),
      locked: details ? null : <PremiumCard />,
    },
  };

  return (
    <View style={[styles.screen, { backgroundColor: look.background }]}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={refresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
            progressBackgroundColor={theme.surfaceContainerHigh}
            progressViewOffset={insets.top}
          />
        }>
        <TodayClean v={view} look={look} />
        <View style={[styles.foot, { paddingHorizontal: look.gutter }]}>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
            {syncLine}
          </ThemedText>
        </View>
      </ScrollView>
      {/* The status bar's strip: content scrolls under it, never under the clock. */}
      <View pointerEvents="none" style={[styles.statusInset, { height: insets.top, backgroundColor: look.background }]} />
      <View pointerEvents="box-none" style={[styles.snack, { left: look.gutter, right: look.gutter }]}>
        <Snackbar
          message={snack?.text ?? null}
          action={snack?.undo ? { label: 'Undo', onPress: () => water.undo(snack.undo!) } : undefined}
          onDismiss={() => setSnack(null)}
        />
      </View>
    </View>
  );
}

/** The untimed-steps note, a goal suggestion and the weather offer: what follows the tiles. */
function BelowTheFold({
  weatherDay,
  untimed,
  onGoal,
  onLocation,
}: {
  weatherDay: string;
  /** The untimed-steps note, or null when every step has a time. */
  untimed: string | null;
  onGoal: (goal: number) => void;
  onLocation: () => void;
}) {
  const { repo, profile, dataVersion } = useApp();
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const [askLocation, setAskLocation] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [recent, allowed, dismissed] = await Promise.all([
        repo.getDays(addDaysToKey(weatherDay, -SUGGESTION_DAYS), addDaysToKey(weatherDay, -1)),
        locationAllowed(),
        repo.getKv<boolean>(WEATHER_PROMPT_KEY),
      ]);
      if (!live) return;
      setSuggestion(suggestGoal(recent.map((d) => d.steps), profile.dailyGoal));
      setAskLocation(!allowed && !dismissed);
    })();
    return () => {
      live = false;
    };
  }, [repo, weatherDay, dataVersion, profile.dailyGoal]);

  return (
    <>
      {untimed ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          {untimed}
        </ThemedText>
      ) : null}
      {suggestion ? (
        <Card title="New goal?" right={<ThemedText type="numeralSmall">{formatSteps(suggestion)}</ThemedText>}>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            From your last two weeks
          </ThemedText>
          <Button label={`Use ${formatSteps(suggestion)}`} variant="tonal" onPress={() => onGoal(suggestion)} />
        </Card>
      ) : null}

      {askLocation ? (
        <Card title="Add the weather to your days">
          <View style={styles.inline}>
            <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.grow}>
              Approximate location only
            </ThemedText>
            <Why
              title="Weather"
              text="With your approximate location, the app notes the weather each day you open it, so Insights can show how heat and rain change your walking. Your location stays on this phone."
            />
          </View>
          <View style={styles.buttons}>
            <Button
              label="Not now"
              variant="text"
              compact
              onPress={async () => {
                await repo.setKv(WEATHER_PROMPT_KEY, true);
                setAskLocation(false);
              }}
            />
            <Button
              label="Allow"
              variant="tonal"
              compact
              onPress={async () => {
                if (await requestLocation()) {
                  setAskLocation(false);
                  onLocation();
                }
              }}
            />
          </View>
        </Card>
      ) : null}
    </>
  );
}

function sumOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  foot: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: Spacing.two, paddingBottom: Spacing.five },
  statusInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  snack: { position: 'absolute', bottom: Spacing.three },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
