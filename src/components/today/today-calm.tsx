/**
 * Today, the Activity part, in the plain sage-and-sand look (owner, 17 Nov
 * 2026: "I need the app exactly as in the mock.. pixel to pixel"; the mock is
 * plain.html?s=a&k=1&ic=1&icx=1). Top row: calendar, the Nutrition · Activity
 * · Meet switch and the avatar. Then the date line, Steps today in the sage
 * tile, Distance and Active, Food and Sleep, Water with its plus, the walk in
 * the sand tile, and the sync line. Every tap, figure and slot is as before;
 * News and Log food left Today with the three-part switch (Nutrition opens Food).
 */

import { StyleSheet, View } from 'react-native';

import { Big, Caps, Label, Mid, Note, Num, Pair, plainStyles as ps, Round, Sub, SyncLine, Tile, TopRow, Words } from '@/components/plain/plain-kit';
import { PLAIN, PLAIN_SIZE } from '@/components/plain/plain-theme';
import { MaxContentWidth } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';
import { formatSteps } from '@/lib/format';

import { dailyQuote } from './model';
import { activeRange } from './steps-tile-model';
import { useCountUp } from './time-of-day-parts';
import { foodTile, lockedTileModel, sleepTile, TILE_KINDS, type TileKind, walkTile, waterTile } from './today-layout';
import type { TodayFrameLook, TodayView } from './view';

const S = scaled;

/** Active's goal line: 30 active minutes. */
const ACTIVE_GOAL_MIN = 30;

function modelsOf(v: TodayView) {
  if (!v.details) {
    const [food, water, sleep, walk] = TILE_KINDS.map(lockedTileModel);
    return { food, water, sleep, walk, locked: true };
  }
  return {
    food: foodTile(v.food),
    water: waterTile(v.water),
    sleep: sleepTile(v.sleep, v.sleepSpoken),
    walk: walkTile(v.walk, v.walkSpoken),
    locked: false,
  };
}

/** Where a tile's tap goes: its screen, or the premium card when locked. */
function tapFor(v: TodayView, kind: TileKind): () => void {
  if (!v.details) return v.on.premium;
  return { food: v.on.food, water: v.on.water, sleep: v.on.sleep, walk: v.on.walk }[kind];
}

function share(v: TodayView): number {
  return v.goal > 0 ? Math.min(1, Math.max(0, v.steps / v.goal)) : 0;
}

function distanceText(v: TodayView): { value: string; unit: string } {
  return v.distance && Number(v.distance.value) > 0
    ? { value: v.distance.value, unit: v.distance.unit }
    : { value: '0', unit: v.distance?.unit ?? v.distanceUnit };
}

/** "5.9": one decimal under 10, none above. */
function short(n: number): string {
  return n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
}

/** The date line: the date in bold, the weather (or its offer) and the day's quote. */
function DateLine({ v }: { v: TodayView }) {
  const extra = v.weather ? null : (v.slots.dateExtra ?? null);
  const rest = [v.weather?.text, dailyQuote(v.dayKey)].filter(Boolean).join(' · ');
  if (!extra) return <Sub lead={v.dateLabel} rest={rest} />;
  return (
    <View style={styles.dateRow}>
      <Sub lead={v.dateLabel} />
      <Words size={15} color={PLAIN.muted}>
        ·
      </Words>
      {extra}
    </View>
  );
}

export function TodayCalm({ v, sync }: { v: TodayView; look: TodayFrameLook; sync?: string }) {
  const m = modelsOf(v);
  const L = m.locked;
  const d = distanceText(v);
  const steps = useCountUp(Math.max(0, v.steps));
  const range = activeRange(v.hourly, v.nowHour);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const toGo = Math.max(0, v.goal - v.steps);
  const past = Math.max(0, v.steps - v.goal);
  const s = share(v);
  const dist = Number(d.value) || 0;
  const distOf = s > 0 && dist > 0 ? `of ${short(dist / s)} ${d.unit}` : `goal ${formatSteps(v.goal)} steps`;
  const active = Math.max(0, Math.round(v.activeMin ?? 0));
  const tail = v.details ? v.slots.below : v.slots.locked;

  return (
    <View style={[styles.column, { gap: S(PLAIN_SIZE.gapRoomy) }]}>
      <TopRow part="activity" initial={v.initial} onCalendar={() => v.on.calendar()} />
      <DateLine v={v} />

      <Tile kind="hero" roomy onPress={v.on.steps} label={v.stepsSpoken} style={{ paddingTop: S(16), paddingBottom: S(18) }}>
        <View style={ps.spread}>
          <Label icon="steps" text="Steps today" />
          {range ? <Caps text={range.replace('NOW', time)} /> : null}
        </View>
        <View style={[ps.spread, { alignItems: 'flex-end', marginTop: S(6) }]}>
          <Big text={formatSteps(steps)} size={104} line={104} />
          <View style={{ alignItems: 'flex-end', paddingBottom: S(10) }}>
            <Mid value={`${v.pct}%`} />
            <Note>of {formatSteps(v.goal)}</Note>
          </View>
        </View>
        <Note size={14} style={{ marginTop: S(4) }}>
          {past > 0 ? `${formatSteps(past)} past your goal` : `${formatSteps(toGo)} to go`}
        </Note>
      </Tile>

      {v.slots.walking}

      <Pair>
        <Tile roomy onPress={v.on.steps} label={`Distance ${d.value} ${d.unit}`} style={ps.half}>
          <Label icon="pin" text="Distance" />
          <Num value={d.value} unit={d.unit} roomy />
          <Note lines={1}>{distOf}</Note>
        </Tile>
        <Tile roomy onPress={v.on.steps} label={`Active ${active} minutes`} style={ps.half}>
          <Label icon="bolt" text="Active" />
          <Num value={String(active)} unit="min" roomy />
          <Note lines={1}>goal {ACTIVE_GOAL_MIN} min</Note>
        </Tile>
      </Pair>

      <Pair>
        <Tile roomy onPress={tapFor(v, 'food')} label={m.food.spoken} style={ps.half}>
          <Label icon={L ? 'lock' : 'bowl'} text="Food" />
          {L ? <Num value={m.food.value} roomy /> : <Num value={v.food.text} unit="kcal" roomy />}
          {L ? null : <Note lines={1}>of {v.food.target} kcal</Note>}
        </Tile>
        <Tile roomy onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} style={ps.half}>
          <Label icon={L ? 'lock' : 'moon'} text="Sleep" />
          <Num value={!L && v.sleep ? `${v.sleep.h}h ${v.sleep.m}m` : m.sleep.value} roomy />
          {L ? null : <Note lines={1}>{v.sleep ? 'last night' : 'no data yet'}</Note>}
        </Tile>
      </Pair>

      <Tile roomy onPress={tapFor(v, 'water')} label={m.water.spoken} style={ps.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label icon={L ? 'lock' : 'drop'} text="Water" />
          {L ? (
            <Num value={m.water.value} roomy />
          ) : (
            <Num value={String(v.water.glasses)} unit={v.water.of ? `of ${v.water.of} glasses` : v.water.glasses === 1 ? 'glass' : 'glasses'} roomy />
          )}
        </View>
        {L ? null : (
          <Round main onPress={v.on.addGlass} label="Add a glass of water">
            <Words size={22} color={PLAIN.onMain} line={24}>
              +
            </Words>
          </Round>
        )}
      </Tile>

      <Tile kind="second" roomy onPress={tapFor(v, 'walk')} label={m.walk.spoken}>
        <Label icon={L ? 'lock' : 'walk'} text={v.walk && !L ? v.walk.title : 'Walk'} />
        {L ? (
          <Num value={m.walk.value} roomy />
        ) : v.walk ? (
          <>
            <Num value={v.walk.distance.value} unit={v.walk.distance.unit} roomy />
            <Note lines={1}>{[v.walk.time, m.walk.note].filter(Boolean).join(' · ')}</Note>
          </>
        ) : (
          <>
            <Num value="No walk yet" roomy />
            <Note lines={1}>Tap to see your walks</Note>
          </>
        )}
      </Tile>

      {tail ? <View style={{ gap: S(10) }}>{tail}</View> : null}

      {sync ? <SyncLine text={sync} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: S(PLAIN_SIZE.gutter),
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: S(4) },
});
