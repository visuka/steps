import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, SectionHeader, Surface } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { phoneSplit } from '@/health/phone-steps';
import { useTheme } from '@/hooks/use-theme';
import { addDays, startOfDay } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { useApp } from '@/state/app-state';

import { type CounterLogEntry, type RecorderStatus, StepCounter, type UntimedSteps } from '../../modules/step-counter';

const time = (ms: number) =>
  new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

const RECORDER_TEXT: Record<RecorderStatus, string> = {
  ready: 'On',
  'update-needed': 'Needs a Google Play services update',
  unavailable: 'Not on this phone (no Google Play services)',
};

const BY_HOUR_WHY =
  'Google’s recorder keeps the time of every step. The app’s own counter only knows them while it runs; steps from while it was stopped are listed under "No known time" instead.';

interface Check {
  recorder: RecorderStatus | null;
  recorderSince: number | null;
  counterRunning: boolean | null;
  /** Hour → [Google's recorder, the app's own counter], for today. */
  hours: [number, number, number][];
  untimed: UntimedSteps[];
  /** Where Google's recorder takes over: the counter's gaps after it are in the recorder, with times. */
  split: number;
  log: CounterLogEntry[];
}

async function readCheck(): Promise<Check> {
  if (!StepCounter) {
    return { recorder: null, recorderSince: null, counterRunning: null, hours: [], untimed: [], split: Infinity, log: [] };
  }
  const now = Date.now();
  const dayStart = startOfDay(new Date()).getTime();
  const recorder = StepCounter.recorderStatus();
  const [counted, recorded, untimed, log] = await Promise.all([
    StepCounter.getBuckets(dayStart, now),
    recorder === 'ready' ? StepCounter.getRecorderBuckets(dayStart, now).catch(() => []) : Promise.resolve([]),
    StepCounter.getUntimed(addDays(new Date(dayStart), -1).getTime(), now),
    StepCounter.getLog(40),
  ]);
  const byHour = new Map<number, [number, number]>();
  for (const m of recorded) {
    const h = new Date(m.start).getHours();
    byHour.set(h, [(byHour.get(h)?.[0] ?? 0) + m.steps, byHour.get(h)?.[1] ?? 0]);
  }
  for (const m of counted) {
    const h = new Date(m.start).getHours();
    byHour.set(h, [byHour.get(h)?.[0] ?? 0, (byHour.get(h)?.[1] ?? 0) + m.steps]);
  }
  return {
    recorder,
    recorderSince: StepCounter.recorderSince(),
    counterRunning: StepCounter.isRunning(),
    hours: [...byHour].sort((a, b) => a[0] - b[0]).map(([h, [r, c]]) => [h, r, c]),
    untimed,
    split: phoneSplit(StepCounter, now),
    log,
  };
}

/**
 * For checking the counts on a real phone: where today's steps came from,
 * hour by hour from both counters when the phone has both, which steps have
 * no known time and why, and what the counter did lately.
 */
export default function StepCheckScreen() {
  const { source, today, displaySteps, lastSyncAt, refresh } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [check, setCheck] = useState<Check | null>(null);

  const load = useCallback(() => readCheck().then(setCheck), []);

  useEffect(() => {
    let live = true;
    readCheck().then((c) => live && setCheck(c));
    return () => {
      live = false;
    };
  }, [lastSyncAt]);

  const recorderTotal = check?.hours.reduce((s, [, r]) => s + r, 0) ?? 0;
  const counterTotal = check?.hours.reduce((s, [, , c]) => s + c, 0) ?? 0;
  // Nothing past the Today card on a phone without the counter (iOS), so no Premium card there either.
  const more = !!check && (check.hours.length > 0 || check.untimed.length > 0 || check.log.length > 0);
  const early = check?.untimed.filter((u) => u.from < check.split) ?? [];
  const late = check?.untimed.filter((u) => u.from >= check.split) ?? [];

  return (
    <Screen title="Step check" subtitle="Where today's steps came from" onBack={() => router.back()}>
      <Card title="Today">
        <View style={styles.lines}>
          <Line label="Shown on Today" value={formatSteps(displaySteps)} strong />
          <Line label="Saved at the last sync" value={formatSteps(today?.steps ?? 0)} />
          <Line label="With no known time" value={formatSteps(today?.untimedSteps ?? 0)} />
          <Line label="Last sync" value={lastSyncAt ? time(lastSyncAt) : 'Not yet'} />
          <Line label="Source" value={source.label} />
          {check?.recorder ? <Line label="Google's step recorder" value={RECORDER_TEXT[check.recorder]} /> : null}
          {check?.recorderSince ? <Line label="Recording since" value={time(check.recorderSince)} /> : null}
          {check?.counterRunning != null ? (
            <Line label="The app's own counter" value={check.counterRunning ? 'Running' : 'Stopped'} />
          ) : null}
        </View>
        <Button variant="tonal" icon="sync-outline" label="Sync now" onPress={() => refresh().then(load)} />
      </Card>

      {/* The Today card is free, so anyone can check their steps are being counted. Steps by the hour are
          premium, as on Today; the untimed stretches and the log go with them, since they list steps with times. */}
      {more ? (
        <PremiumGate feature="today-details">
          {check?.hours.length ? (
            <>
              <SectionHeader title="Today by hour" why={BY_HOUR_WHY} />
              <Surface level={1} style={styles.table}>
                <View style={styles.row}>
                  <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.hour}>
                    Hour
                  </ThemedText>
                  <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.num}>
                    Recorder
                  </ThemedText>
                  <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.num}>
                    Counter
                  </ThemedText>
                </View>
                {check.hours.map(([h, r, c]) => (
                  <View key={h} style={[styles.row, styles.ruled, { borderTopColor: theme.outlineVariant }]}>
                    <ThemedText type="bodyMedium" style={styles.hour}>{`${h}:00`}</ThemedText>
                    <ThemedText type="bodyMedium" style={styles.num}>
                      {formatSteps(r)}
                    </ThemedText>
                    <ThemedText type="bodyMedium" style={styles.num}>
                      {formatSteps(c)}
                    </ThemedText>
                  </View>
                ))}
                <View style={[styles.row, styles.total, { borderTopColor: theme.outline }]}>
                  <ThemedText type="titleSmall" style={styles.hour}>
                    Total
                  </ThemedText>
                  <ThemedText type="titleSmall" style={styles.num}>
                    {formatSteps(recorderTotal)}
                  </ThemedText>
                  <ThemedText type="titleSmall" style={styles.num}>
                    {formatSteps(counterTotal)}
                  </ThemedText>
                </View>
              </Surface>
            </>
          ) : null}

          {early.length ? (
            <>
              <SectionHeader title="No known time" why="Since yesterday. Each stretch counts for the day it began, in no hour." />
              <Stretches items={early} />
            </>
          ) : null}

          {late.length ? (
            <>
              <SectionHeader
                title="Missed by the app's counter"
                why="Google’s recorder has these steps with their times, so they are in the hours above and not added again."
              />
              <Stretches items={late} />
            </>
          ) : null}

          {check?.log.length ? (
            <>
              <SectionHeader title="What the counter did" />
              <Surface level={1} style={styles.log}>
                {check.log.map((e) => (
                  <ThemedText key={`${e.t}-${e.kind}-${e.detail}`} type="bodySmall" themeColor="onSurfaceVariant">
                    {time(e.t)} · {e.kind}: {e.detail}
                  </ThemedText>
                ))}
              </Surface>
            </>
          ) : null}
        </PremiumGate>
      ) : null}
    </Screen>
  );
}

/** Stretches of steps with no hour: how many, between when, and why. */
function Stretches({ items }: { items: UntimedSteps[] }) {
  const theme = useTheme();
  return (
    <Surface level={1} style={styles.table}>
      {items.map((u, i) => (
        <View
          key={`${u.from}-${u.to}`}
          style={[styles.stretch, i > 0 && styles.ruled, { borderTopColor: theme.outlineVariant }]}
          accessible>
          <ThemedText type="bodyLarge">{formatSteps(u.steps)} steps</ThemedText>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            {time(u.from)} – {time(u.to)} · {u.reason}
          </ThemedText>
        </View>
      ))}
    </Surface>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'titleMedium' : 'labelLarge'} style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: Spacing.one },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  label: { flex: 1 },
  value: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  table: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, minHeight: 40 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth },
  total: { borderTopWidth: 1, minHeight: 48 },
  hour: { flex: 1, fontVariant: ['tabular-nums'] },
  num: { width: 88, textAlign: 'right', fontVariant: ['tabular-nums'] },
  stretch: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
    minHeight: 72,
    justifyContent: 'center',
  },
  log: { padding: Spacing.three, gap: Spacing.one },
});
