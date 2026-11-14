import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PartialNote } from '@/components/food/nutrition-view';
import { ThemedText } from '@/components/themed-text';
import { TickBar } from '@/components/ui/tick-bar';
import { Spacing } from '@/constants/theme';
import {
  formatNutrient,
  GL_BANDS,
  NUTRIENT,
  type NutrientInfo,
  nutrientNumber,
  NUTRIENTS,
  percentOfDaily,
  percentOfLimit,
} from '@/nutrition/nutrients';
import { AT_LEAST, PARTIAL_NOTE } from '@/nutrition/state';
import type { NutrientKey, Nutrients } from '@/nutrition/types';
import { glBand } from '@/nutrition/watch';

const BAND_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;

/**
 * One row per nutrient that has data: the label and amount on one line, the
 * bar full width under it. Nutrients with a daily target get a bar towards it;
 * "keep low" ones a bar towards their limit, red only at the limit; sugars,
 * glycemic load and alcohol just show the amount. No verdict words: one
 * portion is never "low" (the Food tab's rows use nutrition/state.ts for that).
 * Tapping a row shows what the nutrient is.
 */
export function NutrientBars({
  title,
  nutrients,
  groups,
  keys,
  average,
  glScale = 'portion',
  partial = [],
}: {
  /** A heading, shown only when there is a row to show. */
  title?: string;
  nutrients: Nutrients;
  /** Every nutrient in these groups, in the usual order… */
  groups?: NutrientInfo['group'][];
  /** …or exactly these. */
  keys?: NutrientKey[];
  /**
   * The week's daily average. Nutrients the body stores then show today's
   * share and the week's, with the bar for the week: that's what counts.
   */
  average?: Nutrients;
  /** Whether the glycemic load is a whole day's or one portion's. */
  glScale?: 'day' | 'portion';
  /** Nutrients only partly known (the food's "missing"): shown as "≥", never as complete. */
  partial?: readonly NutrientKey[];
}) {
  const [open, setOpen] = useState<NutrientKey | null>(null);

  const infos = keys ? keys.map((k) => NUTRIENT[k]) : NUTRIENTS.filter((n) => groups?.includes(n.group));
  const rows = infos.filter((n) => {
    const value = nutrients[n.key];
    if (n.key === 'alcohol') return (value ?? 0) > 0;
    return value !== undefined || (average && n.storage === 'stored' && average[n.key] !== undefined);
  });
  if (!rows.length) return null;
  const weekly = Boolean(average && rows.some((n) => n.storage === 'stored'));

  return (
    <View style={styles.list}>
      {title ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title}
        </ThemedText>
      ) : null}
      {weekly ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
          Today · Week
        </ThemedText>
      ) : null}
      {rows.map((n) => {
        const today = nutrients[n.key];
        const week = average && n.storage === 'stored' ? average[n.key] : undefined;
        const row = atLeast(describe(n, today, week, glScale), today !== undefined && partial.includes(n.key));
        const isOpen = open === n.key;
        return (
          <Pressable
            key={n.key}
            onPress={() => setOpen(isOpen ? null : n.key)}
            accessibilityRole="button"
            accessibilityLabel={`${n.label}: ${row.spoken}`}
            accessibilityHint="Shows what this is"
            accessibilityState={{ expanded: isOpen }}
            style={styles.item}>
            <View style={styles.row}>
              <ThemedText type="small" style={styles.label}>
                {n.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
                {row.shown}
              </ThemedText>
            </View>
            {row.bar === null ? null : (
              <TickBar
                value={Math.min(100, row.bar)}
                max={100}
                height={8}
                tone={row.tone === 'danger' ? 'over' : 'food'}
              />
            )}
            {isOpen ? (
              <ThemedText type="small" themeColor="textSecondary">
                {row.note}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
      {rows.some((n) => nutrients[n.key] !== undefined && partial.includes(n.key)) ? <PartialNote /> : null}
    </View>
  );
}

/** A row whose figure is only a floor: "≥ 12 mg · 20%", said as "at least". */
function atLeast(row: Row, partial: boolean): Row {
  if (!partial) return row;
  return {
    ...row,
    shown: `${AT_LEAST}${row.shown}`,
    spoken: `at least ${row.spoken}`,
    note: `${row.note} ${PARTIAL_NOTE}, so this can only go up.`,
  };
}

interface Row {
  /** Bar fill in percent, or null for amount-only rows. */
  bar: number | null;
  tone: 'plain' | 'good' | 'danger';
  shown: string;
  spoken: string;
  note: string;
}

function describe(n: NutrientInfo, today: number | undefined, week: number | undefined, glScale: 'day' | 'portion'): Row {
  const amount = (v: number) => formatNutrient(n.key, v);
  const overUpper = (v: number) => n.upper !== undefined && v > n.upper;
  const upperNote = n.upper !== undefined ? ` Adults are advised not to go over ${amount(n.upper)} a day for long.` : '';

  if (n.daily !== undefined && week !== undefined) {
    const todayPct = today === undefined ? null : percentOfDaily(n.key, today);
    const weekPct = percentOfDaily(n.key, week) ?? 0;
    return {
      bar: weekPct,
      tone: overUpper(week) ? 'danger' : weekPct >= 100 ? 'good' : 'plain',
      shown: `${todayPct === null ? '–' : `${todayPct}%`} · ${weekPct}%`,
      spoken: `today ${todayPct ?? 'none'} percent, 7-day average ${weekPct} percent of the daily value`,
      note: `${n.note} Today ${today === undefined ? 'none logged' : amount(today)}; 7-day average ${amount(week)} a day, of ${amount(n.daily)}.${overUpper(week) ? upperNote : ''}`,
    };
  }

  const value = today ?? 0;
  if (n.daily !== undefined) {
    const pct = percentOfDaily(n.key, value) ?? 0;
    return {
      bar: pct,
      tone: overUpper(value) ? 'danger' : pct >= 100 ? 'good' : 'plain',
      shown: `${amount(value)} · ${pct}%`,
      spoken: `${amount(value)}, ${pct} percent of the daily value`,
      note: `${n.note} Daily value: ${amount(n.daily)}.${overUpper(value) ? upperNote : ''}`,
    };
  }

  if (n.limit !== undefined) {
    const pct = percentOfLimit(n.key, value) ?? 0;
    return {
      bar: pct,
      tone: pct >= 100 ? 'danger' : 'plain',
      shown: `${nutrientNumber(n.key, value)} / ${nutrientNumber(n.key, n.limit)} ${n.unit}`.trim(),
      spoken: `${amount(value)} of at most ${amount(n.limit)}`,
      note: `${n.note} Best kept under ${amount(n.limit)} a day.`,
    };
  }

  if (n.key === 'gl') {
    const band = BAND_LABEL[glBand(value, glScale)];
    return {
      bar: null,
      tone: 'plain',
      shown: `${amount(value)} · ${band}`,
      spoken: `${amount(value)}, ${band.toLowerCase()}`,
      note:
        glScale === 'day'
          ? n.note
          : `How much this portion raises blood glucose, from its carbs and how fast they are absorbed. Up to ${GL_BANDS.portion.low} is low; ${GL_BANDS.portion.high} or more is high.`,
    };
  }

  return { bar: null, tone: 'plain', shown: amount(value), spoken: amount(value), note: n.note };
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  item: { gap: Spacing.one, paddingVertical: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  label: { flex: 1 },
  value: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
