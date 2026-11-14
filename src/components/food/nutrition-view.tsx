import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, type IconName, Surface, TickBar, TrackProgress, Why } from '@/components/ui';
import { heroAlign } from '@/components/ui/track-progress';
import { type ColorScheme, type DataTone, Motion, NumeralMaxScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { Diet } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';
import { type SourceOptions, sourcesFor } from '@/nutrition/diet';
import type { DayMark, GapNote } from '@/nutrition/gaps';
import { gapNoteText, NOTE_FOOTER } from '@/nutrition/note-text';
import { NUTRIENT } from '@/nutrition/nutrients';
import { AT_LEAST, LIMIT_KEYS, type NutrientState, type NutrientStateKind, PARTIAL_NOTE } from '@/nutrition/state';
import type { EnergySplit } from '@/nutrition/targets';
import type { NutrientKey } from '@/nutrition/types';
import { amountNumber, attentionFirst, collapsedRows, groupSummary, kcalBalanceText, type NutrientRowData } from '@/nutrition/view';

import { DietChips } from './food-settings';

// ── calories ─────────────────────────────────────────────────────────────

/**
 * The day's energy on a red-oxide track; past the target it starts a second lap, never red.
 * `atLeast`: some ingredient isn't counted yet, so the figure is a floor ("≥").
 */
export function CaloriesTrack({
  eaten,
  target,
  label = 'of about',
  atLeast = false,
}: {
  eaten: number;
  target: number;
  label?: string;
  atLeast?: boolean;
}) {
  return (
    <Card tone="food">
      <TrackProgress
        value={eaten}
        goal={target}
        tone="food"
        aspect={1.9}
        maxHeight={184}
        accessibilityLabel={`${atLeast ? 'at least ' : ''}${formatSteps(eaten)} kcal ${label} ${formatSteps(target)}. ${kcalBalanceText(eaten, target)}${atLeast ? `. ${PARTIAL_NOTE}` : ''}`}>
        <ThemedText
          type="numeralLarge"
          maxFontSizeMultiplier={NumeralMaxScale}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ textAlign: heroAlign }}>
          {atLeast ? AT_LEAST : ''}
          {formatSteps(eaten)}
        </ThemedText>
        <ThemedText type="labelLarge" themeColor="onSurfaceVariant" style={{ textAlign: heroAlign }} numberOfLines={1}>
          kcal {label} {formatSteps(target)}
        </ThemedText>
      </TrackProgress>
      <View style={styles.inline}>
        <ThemedText type="titleSmall" style={styles.grow}>
          {kcalBalanceText(eaten, target)}
        </ThemedText>
        <Why
          title="Your day’s energy"
          text="About what your body uses in a day: its resting energy, plus your walking or a fifth more for moving about, whichever is more. It is an estimate. Add your birth year in Settings to make it closer."
        />
      </View>
      {atLeast ? <PartialNote /> : null}
    </Card>
  );
}

// ── bars and rows ────────────────────────────────────────────────────────

/** Beside "≥" figures: a part of some food isn't counted yet. Never hidden, never shown as complete. */
export function PartialNote() {
  const theme = useTheme();
  return (
    <View style={styles.partial}>
      <Ionicons name="hourglass-outline" size={16} color={theme.onSurfaceVariant} />
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.grow}>
        {AT_LEAST}
        {PARTIAL_NOTE}
      </ThemedText>
    </View>
  );
}

const anyPartial = (rows: NutrientRowData[]) => rows.some((r) => r.partial && r.state.state !== 'unknown');

const STATE_ICON: Partial<Record<NutrientStateKind, IconName>> = {
  ok: 'checkmark-circle-outline',
  over: 'alert-circle',
  near: 'warning-outline',
  low: 'arrow-down-circle-outline',
  soFar: 'time-outline',
  sun: 'sunny-outline',
  unknown: 'help-circle-outline',
};

/** The mark colour for a state: data colours only on the bar, neutral for "so far" and numbers only. */
function barPaint(theme: ColorScheme, s: NutrientState): { tone: DataTone; color?: string } {
  switch (s.state) {
    case 'over':
      return { tone: 'over' };
    case 'near':
    case 'low':
      return { tone: 'near' };
    case 'soFar':
    case 'sun':
    case 'plain':
      return { tone: 'food', color: theme.outline };
    default:
      return { tone: 'food' };
  }
}

function iconColor(theme: ColorScheme, s: NutrientState): string {
  if (s.state === 'over') return theme.over;
  if (s.state === 'near' || s.state === 'low') return theme.near;
  return theme.onSurfaceVariant;
}

/** Label and state word on top, the bar full width under them, the amount under that. */
function NutrientRow({ row, open, onToggle, extra }: { row: NutrientRowData; open: boolean; onToggle: () => void; extra?: string }) {
  const theme = useTheme();
  const s = row.state;
  const paint = barPaint(theme, s);
  const icon = STATE_ICON[s.state];
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={extra ? `${row.spoken}, ${extra}` : row.spoken}
      accessibilityHint={open ? 'Hides the details' : 'Shows why it matters and good foods'}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceContainerHighest }]}>
      <View style={styles.rowTop}>
        <ThemedText type="bodyLarge" style={styles.grow}>
          {row.label}
        </ThemedText>
        {s.word ? (
          <View style={styles.state}>
            {icon ? <Ionicons name={icon} size={16} color={iconColor(theme, s)} /> : null}
            <ThemedText type="labelMedium">{s.word}</ThemedText>
          </View>
        ) : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.onSurfaceVariant} />
      </View>
      <TickBar
        value={s.bar}
        max={100}
        height={8}
        tone={paint.tone}
        color={paint.color}
        mark={s.lowTick === null ? null : s.lowTick / 100}
      />
      {/* Unknown already says "Not known" beside the label. */}
      {s.state === 'unknown' && !extra ? null : (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          {extra ? `${row.valueText} · ${extra}` : row.valueText}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** "1,300 mg", "2.4 µg". */
function amountWithUnit(key: NutrientKey, value: number): string {
  const unit = NUTRIENT[key].unit;
  return unit ? `${amountNumber(key, value)} ${unit}` : amountNumber(key, value);
}

/** What opens under a row: why it matters, the lines, coverage, good foods for the person's diet. */
function RowDetail({
  row,
  diet,
  sourceOpts,
  plain,
  weekWord,
  onNotForMe,
}: {
  row: NutrientRowData;
  diet: Diet | null;
  sourceOpts: SourceOptions;
  plain: boolean;
  weekWord?: string | null;
  onNotForMe: (id: string, label: string) => void;
}) {
  const info = NUTRIENT[row.key];
  const t = row.state.target;
  const isLimit = LIMIT_KEYS.includes(row.key);
  const lines: string[] = [];
  if (isLimit && t.limit) lines.push(`Best under ${amountWithUnit(row.key, t.limit)} a day`);
  else if (t.daily) {
    const low = !plain && t.low !== undefined ? ` · usual line ${amountWithUnit(row.key, t.low)}` : '';
    lines.push(`Daily need ${amountWithUnit(row.key, t.daily)}${low}`);
  }
  if (info.storage === 'stored') lines.push('Your body stores this, so the week counts more');
  if (weekWord) lines.push(`This week: ${weekWord}`);
  if (row.partial) lines.push(`${PARTIAL_NOTE}: the figure can only go up`);
  if (row.coverage > 0 && row.coverage < 1) lines.push(`Known for ${Math.round(row.coverage * 100)}% of what you ate`);
  const showSources = !plain && !isLimit && !['kcal', 'carbs', 'fat'].includes(row.key);
  const sources = showSources ? sourcesFor(row.key, diet, { ...sourceOpts, limit: 5 }) : null;

  return (
    <Animated.View entering={FadeIn.duration(Motion.duration.short)} style={styles.detail}>
      <ThemedText type="bodyMedium">{info.why}</ThemedText>
      {lines.map((l) => (
        <ThemedText key={l} type="bodySmall" themeColor="onSurfaceVariant">
          {l}
        </ThemedText>
      ))}
      {sources ? <SourceChips sources={sources} onNotForMe={onNotForMe} /> : null}
      <Why title={info.label} text={info.note} label="More" />
    </Animated.View>
  );
}

/** Good foods as chips; a chip's × says "not for me", and it isn't suggested again. */
function SourceChips({
  sources,
  onNotForMe,
}: {
  sources: ReturnType<typeof sourcesFor>;
  onNotForMe: (id: string, label: string) => void;
}) {
  if (!sources.foods.length && !sources.line) return null;
  return (
    <View style={styles.sources}>
      {sources.foods.length ? (
        <>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            Good sources
          </ThemedText>
          <View style={styles.chips}>
            {sources.foods.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                icon="close"
                onPress={() => onNotForMe(f.id, f.label)}
                accessibilityLabel={`${f.label}. Tap if it’s not for you.`}
              />
            ))}
          </View>
        </>
      ) : null}
      {sources.line ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          {sources.line}
        </ThemedText>
      ) : null}
    </View>
  );
}

export interface GroupProps {
  rows: NutrientRowData[];
  diet: Diet | null;
  sourceOpts: SourceOptions;
  plain: boolean;
  onNotForMe: (id: string, label: string) => void;
  /** Words added after a row's amount, e.g. "over on 3 of 7 days". */
  extra?: Partial<Record<NutrientKey, string>>;
  /** The week's state word for stored nutrients, on the Day tab. */
  weekWords?: Partial<Record<NutrientKey, string>>;
}

/** Rows that open in place; one open at a time. */
function Rows({ rows, diet, sourceOpts, plain, onNotForMe, extra, weekWords }: GroupProps) {
  const [open, setOpen] = useState<NutrientKey | null>(null);
  return (
    <View style={styles.rows}>
      {rows.map((r) => (
        <View key={r.key}>
          <NutrientRow row={r} open={open === r.key} onToggle={() => setOpen(open === r.key ? null : r.key)} extra={extra?.[r.key]} />
          {open === r.key ? (
            <RowDetail row={r} diet={diet} sourceOpts={sourceOpts} plain={plain} weekWord={weekWords?.[r.key]} onNotForMe={onNotForMe} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Vitamins or Minerals: a one-line count, the rows that need a look first,
 * then "Show all".
 */
export function NutrientGroupCard({ title, why, ...group }: GroupProps & { title: string; why: string }) {
  const [all, setAll] = useState(false);
  const summary = group.plain ? 'Numbers only' : groupSummary(group.rows);
  const shown = all ? attentionFirst(group.rows) : collapsedRows(group.rows);
  return (
    <Card title={title} right={<Why title={title} text={why} />}>
      {summary ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          {summary}
        </ThemedText>
      ) : null}
      {anyPartial(group.rows) ? <PartialNote /> : null}
      {shown.length ? <Rows {...group} rows={shown} /> : null}
      <Button
        label={all ? 'Show fewer' : `Show all ${group.rows.length}`}
        variant="text"
        compact
        onPress={() => setAll(!all)}
        style={styles.textButton}
      />
    </Card>
  );
}

// ── macros ───────────────────────────────────────────────────────────────

/** Protein, carbs, fat and fibre against the person's own targets, and how the energy splits. */
export function MacrosCard({ split, splitLine, ...group }: GroupProps & { split: EnergySplit | null; splitLine?: string | null }) {
  return (
    <Card title="Macros">
      <Rows {...group} />
      {anyPartial(group.rows) ? <PartialNote /> : null}
      {split ? <SplitBar split={split} /> : null}
      {splitLine ? <ThemedText type="titleSmall">{splitLine}</ThemedText> : null}
    </Card>
  );
}

/** One flat bar split three ways in the red-oxide family, white ticks between, numbers in the legend. */
function SplitBar({ split }: { split: EnergySplit }) {
  const theme = useTheme();
  const parts = [
    { key: 'carbs', label: 'Carbs', value: split.carbs, color: theme.food },
    // Three marks of the red-oxide family, each 3:1 on the lane and the card (tokens.test.ts).
    { key: 'protein', label: 'Protein', value: split.protein, color: theme.food2 },
    { key: 'fat', label: 'Fat', value: split.fat, color: theme.food3 },
  ];
  const spoken = `Energy from carbs ${split.carbs} percent, protein ${split.protein} percent, fat ${split.fat} percent`;
  return (
    <View style={styles.split} accessible accessibilityLabel={spoken}>
      <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
        Energy from
      </ThemedText>
      <View style={[styles.splitBar, { backgroundColor: theme.lane }]}>
        {parts.map((p, i) =>
          p.value > 0 ? (
            <View
              key={p.key}
              style={{
                flex: p.value,
                backgroundColor: p.color,
                borderLeftWidth: i > 0 ? 2 : 0,
                borderLeftColor: theme.tick,
              }}
            />
          ) : null,
        )}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: p.color, borderColor: theme.outlineVariant }]} />
            <ThemedText type="labelLarge">
              {p.label} {p.value}%
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── watch-outs ───────────────────────────────────────────────────────────

/** Sodium, added sugar, saturated and trans fat, the day's glycemic load, and foods high in something. */
export function WatchCard({ glLine, chips, ...group }: GroupProps & { glLine?: string | null; chips?: string[] }) {
  const theme = useTheme();
  return (
    <Card
      title="Watch-outs"
      right={
        <Why
          title="Watch-outs"
          text="Salt, added sugar, saturated fat and trans fat are best kept under a limit each day. The bar fills towards that limit, and Too much shows when a day passes it."
        />
      }>
      <Rows {...group} />
      {anyPartial(group.rows) ? <PartialNote /> : null}
      {glLine ? <ThemedText type="bodyMedium">{glLine}</ThemedText> : null}
      {chips?.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <Surface key={c} level={3} radius={Radius.sm} style={styles.flag}>
              <View style={[styles.dot, { backgroundColor: theme.near }]} />
              <ThemedText type="labelLarge">{c}</ThemedText>
            </Surface>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

// ── the gap note ─────────────────────────────────────────────────────────

/** The one note of the day, when there is one: what, why, good foods, and "Got it". */
export function GapNoteCard({
  note,
  diet,
  sourceOpts,
  onDismiss,
  onDiet,
  onNotForMe,
}: {
  note: GapNote;
  diet: Diet | null;
  sourceOpts: SourceOptions;
  onDismiss: () => void;
  onDiet: (d: Diet) => void;
  onNotForMe: (id: string, label: string) => void;
}) {
  const text = gapNoteText(note, diet, sourceOpts);
  const why =
    note.kind === 'week'
      ? `${NOTE_FOOTER} Your body stores this, so it is noted only after two low weeks in a row.`
      : `${NOTE_FOOTER} It was under the usual line on 3 of your last 4 full days.`;
  return (
    <Card level={3}>
      <ThemedText type="titleMedium">{text.title}</ThemedText>
      <ThemedText type="bodyMedium">{text.why}</ThemedText>
      {diet === null ? (
        <>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            What do you eat?
          </ThemedText>
          <DietChips value={null} onChange={onDiet} />
        </>
      ) : null}
      <SourceChips sources={text.sources} onNotForMe={onNotForMe} />
      {text.doctor ? <ThemedText type="bodyMedium">{text.doctor}</ThemedText> : null}
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        {text.footer}
      </ThemedText>
      <View style={styles.buttons}>
        <Why title="About this note" text={why} />
        <Button label="Got it" variant="tonal" compact onPress={onDismiss} />
      </View>
    </Card>
  );
}

// ── the end of the day ───────────────────────────────────────────────────

/** "That's all for today" (or "Fasting today"), so the day can be judged; Undo once marked. */
export function DayDone({ mark, judged, onMark }: { mark: DayMark | null; judged: boolean; onMark: (m: DayMark | null) => void }) {
  const theme = useTheme();
  if (!mark) {
    return (
      <View style={styles.dayDone}>
        <Button label="That’s all for today" icon="checkmark-done" variant="outlined" onPress={() => onMark('complete')} />
        <Button label="Fasting today" variant="text" compact onPress={() => onMark('fasting')} style={styles.center} />
      </View>
    );
  }
  return (
    <Surface level={1} style={styles.marked}>
      <Ionicons name={mark === 'fasting' ? 'moon-outline' : 'checkmark-done'} size={20} color={theme.onSurfaceVariant} />
      <View style={styles.grow}>
        <ThemedText type="labelLarge">{mark === 'fasting' ? 'Fasting day: not counted' : 'Marked as a full day'}</ThemedText>
        {mark === 'complete' && !judged ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
            Not much logged, so it won’t count
          </ThemedText>
        ) : null}
      </View>
      <Button label="Undo" variant="text" compact onPress={() => onMark(null)} />
    </Surface>
  );
}

/** A plain one-line card with an icon, e.g. "Log 2 more full days to see your week". */
export function NoteLine({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.inline}>
        <Ionicons name={icon} size={24} color={theme.onSurfaceVariant} />
        <View style={styles.grow}>
          <ThemedText type="titleMedium">{title}</ThemedText>
          {hint ? (
            <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
              {hint}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', alignSelf: 'center' },
  grow: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  partial: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  rows: { gap: Spacing.one, marginHorizontal: -Spacing.two },
  row: { gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, borderRadius: Radius.sm, minHeight: TouchTarget },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  state: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  detail: { gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.three },
  sources: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  textButton: { marginLeft: -Spacing.three },
  split: { gap: Spacing.two },
  splitBar: { flexDirection: 'row', height: 12, borderRadius: Radius.xs, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 12, height: 12, borderRadius: 2, borderWidth: 1 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.two },
  dayDone: { gap: Spacing.one },
  marked: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingLeft: Spacing.three, paddingVertical: Spacing.one },
});
