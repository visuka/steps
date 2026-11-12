import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/controls';
import { PremiumGate } from '@/components/premium-gate';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { phoneSplit } from '@/health/phone-steps';
import { addDays, startOfDay } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { useApp } from '@/state/app-state';

import { type CounterLogEntry, type RecorderStatus, StepCounter, type UntimedSteps } from '../../modules/step-counter';

const time = (ms: number) =>
  new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

const RECORDER_TEXT: Record<RecorderStatus, string> = {
  ready: 'on',
  'update-needed': 'needs a Google Play services update',
  unavailable: 'not on this phone (no Google Play services)',
};

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

  return (
    <Screen title="Step check" onBack={() => router.back()}>
      <Card title="Today">
        <Line label="Shown on Today" value={formatSteps(displaySteps)} />
        <Line label="Saved at the last sync" value={formatSteps(today?.steps ?? 0)} />
        <Line label="…of which with no known time" value={formatSteps(today?.untimedSteps ?? 0)} />
        <Line label="Last sync" value={lastSyncAt ? time(lastSyncAt) : 'not yet'} />
        <Line label="Source" value={source.label} />
        {check?.recorder ? <Line label="Google's step recorder" value={RECORDER_TEXT[check.recorder]} /> : null}
        {check?.recorderSince ? <Line label="Recording since" value={time(check.recorderSince)} /> : null}
        {check?.counterRunning != null ? (
          <Line label="The app's own counter" value={check.counterRunning ? 'running' : 'stopped'} />
        ) : null}
        <Button kind="secondary" label="Sync now" onPress={() => refresh().then(load)} />
      </Card>

      {/* The Today card is free, so anyone can check their steps are being counted. Steps by the hour are
          premium, as on Today; the untimed stretches and the log go with them, since they list steps with times. */}
      {more ? (
        <PremiumGate feature="today-details">
          {check?.hours.length ? (
            <Card title="Today by hour">
              <ThemedText type="small" themeColor="textSecondary">
                Google&apos;s recorder keeps the time of every step. The app&apos;s own counter only knows them while it
                runs; steps from while it was stopped are listed under &quot;No known time&quot; instead.
              </ThemedText>
              <View style={styles.row}>
                <ThemedText type="smallBold" style={styles.hour}>
                  Hour
                </ThemedText>
                <ThemedText type="smallBold" style={styles.num}>
                  Recorder
                </ThemedText>
                <ThemedText type="smallBold" style={styles.num}>
                  Counter
                </ThemedText>
              </View>
              {check.hours.map(([h, r, c]) => (
                <View key={h} style={styles.row}>
                  <ThemedText style={styles.hour}>{`${h}:00`}</ThemedText>
                  <ThemedText style={styles.num}>{formatSteps(r)}</ThemedText>
                  <ThemedText style={styles.num}>{formatSteps(c)}</ThemedText>
                </View>
              ))}
              <View style={styles.row}>
                <ThemedText type="smallBold" style={styles.hour}>
                  Total
                </ThemedText>
                <ThemedText type="smallBold" style={styles.num}>
                  {formatSteps(recorderTotal)}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.num}>
                  {formatSteps(counterTotal)}
                </ThemedText>
              </View>
            </Card>
          ) : null}

          {check?.untimed.some((u) => u.from < check.split) ? (
            <Card title="No known time (since yesterday)">
              <ThemedText type="small" themeColor="textSecondary">
                Counted for the day each stretch began, in no hour.
              </ThemedText>
              {check.untimed
                .filter((u) => u.from < check.split)
                .map((u) => (
                  <ThemedText key={`${u.from}-${u.to}`} type="small">
                    {formatSteps(u.steps)} steps between {time(u.from)} and {time(u.to)}: {u.reason}
                  </ThemedText>
                ))}
            </Card>
          ) : null}

          {check?.untimed.some((u) => u.from >= check.split) ? (
            <Card title="Missed by the app's counter">
              <ThemedText type="small" themeColor="textSecondary">
                Google&apos;s recorder has these steps with their times, so they are in the hours above and not added
                again.
              </ThemedText>
              {check.untimed
                .filter((u) => u.from >= check.split)
                .map((u) => (
                  <ThemedText key={`${u.from}-${u.to}`} type="small">
                    {formatSteps(u.steps)} steps between {time(u.from)} and {time(u.to)}: {u.reason}
                  </ThemedText>
                ))}
            </Card>
          ) : null}

          {check?.log.length ? (
            <Card title="What the counter did">
              {check.log.map((e) => (
                <ThemedText key={`${e.t}-${e.kind}-${e.detail}`} type="small" themeColor="textSecondary">
                  {time(e.t)} · {e.kind}: {e.detail}
                </ThemedText>
              ))}
            </Card>
          ) : null}
        </PremiumGate>
      ) : null}
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1 },
  hour: { flex: 1 },
  num: { width: 80, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
