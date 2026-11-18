/**
 * Today, the Activity part, in the plain sage-and-sand look (owner, 17 Nov
 * 2026: "I need the app exactly as in the mock.. pixel to pixel"), as mock d38
 * (owner approved 18 Nov 2026; plain.html?s=a&k=1&ic=1&icx=1&f=4&b=1&h=1&d=38).
 * Top row: calendar and avatar (the Nutrition · Activity · Buddies switch is the
 * bar at the bottom). Then the date line, Steps today in the sage tile (with the
 * sync line inside it), Distance and Active, Food and Sleep, Water with its plus,
 * and the walk in the sand tile (the ad space went, owner 18 Nov 2026). Every tap,
 * figure and slot is as before; News and Log food left Today (Nutrition opens Food).
 */

import { StyleSheet, View } from 'react-native';

import { Big, Caps, Label, Mid, Note, Num, Pair, plainStyles as ps, Round, Sub, Tile, TopRow, Words } from '@/components/plain/plain-kit';
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

/**
 * `squeeze` (0–6, index.tsx) fits a short screen without scrolling. 1: the tiles take the standard
 * padding 14 × 18 (d38's small phone). 2–4: the 9 dp between tiles shrinks to 6. 5–6: for a tall
 * status bar, smaller figures (see below). `bottomInset`: the gesture bar's room, 0 above the part bar.
 */
export function TodayCalm({
  v,
  sync,
  squeeze = 0,
  bottomInset = 0,
}: {
  v: TodayView;
  look: TodayFrameLook;
  sync?: string;
  squeeze?: number;
  bottomInset?: number;
}) {
  const tight = squeeze > 0;
  const gapCut = Math.max(0, Math.min(3, squeeze - 1));
  // Last resort for a tall status bar at 360 x 800 (CI: 43 dp, content 853 of 800 after step 4):
  // 5, the tiles' figures take the standard 34/38; 6, the steps figure 78/82 with less air around it.
  const roomyNum = squeeze < 5;
  const shortHero = squeeze >= 6;
  const box = tight ? PLAIN_SIZE.pad : PLAIN_SIZE.padRoomy;
  const pad = { paddingVertical: S(box.v), paddingHorizontal: S(box.h) };
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
    <View style={[styles.column, { gap: S(PLAIN_SIZE.gap - gapCut) }]}>
      <TopRow initial={v.initial} onCalendar={() => v.on.calendar()} />
      <DateLine v={v} />

      <Tile
        kind="hero"
        roomy
        onPress={v.on.steps}
        label={v.stepsSpoken}
        style={tight ? pad : { paddingTop: S(18), paddingBottom: S(20), paddingHorizontal: S(PLAIN_SIZE.padRoomy.h) }}>
        <View style={ps.spread}>
          <Label icon="steps" text="Steps today" />
          {range ? <Caps text={range.replace('NOW', time)} /> : null}
        </View>
        <View style={{ marginTop: S(shortHero ? 12 : 22) }}>
          <Big text={formatSteps(steps)} size={shortHero ? 78 : 96} line={shortHero ? 82 : 100} />
        </View>
        <View style={[ps.spread, { alignItems: 'baseline', marginTop: S(shortHero ? 10 : 14) }]}>
          <Mid value={`${v.pct}%`} unit={`of ${formatSteps(v.goal)}`} />
          <Note lines={1} style={{ marginTop: 0, flexShrink: 1, textAlign: 'right' }}>
            {past > 0 ? `${formatSteps(past)} past your goal` : `${formatSteps(toGo)} to go`}
          </Note>
        </View>
        {sync ? (
          <Note lines={1} style={{ marginTop: S(6) }}>
            {sync}
          </Note>
        ) : null}
      </Tile>

      {v.slots.walking}

      <Pair>
        <Tile roomy onPress={v.on.steps} label={`Distance ${d.value} ${d.unit}`} style={[ps.half, pad]}>
          <Label icon="pin" text="Distance" />
          <Num value={d.value} unit={d.unit} roomy={roomyNum} />
          <Note lines={1}>{distOf}</Note>
        </Tile>
        <Tile roomy onPress={v.on.steps} label={`Active ${active} minutes`} style={[ps.half, pad]}>
          <Label icon="bolt" text="Active" />
          <Num value={String(active)} unit="min" roomy={roomyNum} />
          <Note lines={1}>goal {ACTIVE_GOAL_MIN} min</Note>
        </Tile>
      </Pair>

      <Pair>
        <Tile roomy onPress={tapFor(v, 'food')} label={m.food.spoken} style={[ps.half, pad]}>
          <Label icon={L ? 'lock' : 'bowl'} text="Food" />
          {L ? <Num value={m.food.value} roomy={roomyNum} /> : <Num value={v.food.text} unit="kcal" roomy={roomyNum} />}
          {L ? null : <Note lines={1}>of {v.food.target} kcal</Note>}
        </Tile>
        <Tile roomy onPress={tapFor(v, 'sleep')} label={m.sleep.spoken} style={[ps.half, pad]}>
          <Label icon={L ? 'lock' : 'moon'} text="Sleep" />
          {!L && v.sleep ? (
            <Num value={`${v.sleep.h}h ${v.sleep.m}m`} pairs={[[String(v.sleep.h), 'h'], [String(v.sleep.m), 'm']]} roomy={roomyNum} />
          ) : (
            <Num value={m.sleep.value} roomy={roomyNum} />
          )}
          {L ? null : <Note lines={1}>{v.sleep ? 'last night' : 'no data yet'}</Note>}
        </Tile>
      </Pair>

      <Tile roomy onPress={tapFor(v, 'water')} label={m.water.spoken} style={[ps.row, pad]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label icon={L ? 'lock' : 'drop'} text="Water" />
          {L ? (
            <Num value={m.water.value} roomy={roomyNum} />
          ) : (
            <Num value={String(v.water.glasses)} unit={v.water.of ? `of ${v.water.of} glasses` : v.water.glasses === 1 ? 'glass' : 'glasses'} roomy={roomyNum} />
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

      <Tile kind="second" roomy onPress={tapFor(v, 'walk')} label={m.walk.spoken} style={pad}>
        <Label icon={L ? 'lock' : 'walk'} text={v.walk && !L ? v.walk.title : 'Walk'} />
        {L ? (
          <Num value={m.walk.value} roomy={roomyNum} />
        ) : v.walk ? (
          <>
            <Num value={v.walk.distance.value} unit={v.walk.distance.unit} roomy={roomyNum} />
            <Note lines={1}>{[v.walk.time, m.walk.note].filter(Boolean).join(' · ')}</Note>
          </>
        ) : (
          <>
            <Num value="No walk yet" roomy={roomyNum} />
            <Note lines={1}>Tap to see your walks</Note>
          </>
        )}
      </Tile>

      {tail ? <View style={{ gap: S(10) }}>{tail}</View> : null}

      {/* The foot: at least 12 dp under the last tile, and clear of the gesture bar. The sync line is in the steps tile (d38). */}
      <View style={{ height: Math.max(S(12) - S(PLAIN_SIZE.gap - gapCut), bottomInset + S(6) - S(PLAIN_SIZE.gap - gapCut), 0) }} />
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
