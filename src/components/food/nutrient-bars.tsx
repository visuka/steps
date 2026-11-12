import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
import type { NutrientKey, Nutrients } from '@/nutrition/types';
import { glBand } from '@/nutrition/watch';

const BAND_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;

/**
 * One row per nutrient that has data. Nutrients with a daily target get a bar
 * towards it; "keep low" ones a bar towards their limit, which turns red at
 * the limit; sugars, glycemic load and alcohol just show the amount. Tapping a
 * row shows what the nutrient is.
 */
export function NutrientBars({
  title,
  nutrients,
  groups,
  keys,
  average,
  glScale = 'portion',
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
}) {
  const theme = useTheme();
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
        <View style={styles.row}>
          <View style={styles.label} />
          <View style={styles.spacer} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
            Today · Week
          </ThemedText>
        </View>
      ) : null}
      {rows.map((n) => {
        const today = nutrients[n.key];
        const week = average && n.storage === 'stored' ? average[n.key] : undefined;
        const row = describe(n, today, week, glScale);
        const color =
          row.tone === 'danger' ? theme.danger : row.tone === 'good' ? theme.accent : theme.text;
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
              {row.bar === null ? (
                <View style={styles.spacer} />
              ) : (
                <View style={[styles.track, { backgroundColor: theme.track }]}>
                  <View style={[styles.fill, { width: `${Math.min(100, row.bar)}%`, backgroundColor: color }]} />
                </View>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
                {row.shown}
              </ThemedText>
            </View>
            {isOpen ? (
              <ThemedText type="small" themeColor="textSecondary">
                {row.note}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
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
  item: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { width: 96 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  spacer: { flex: 1 },
  fill: { height: 8, borderRadius: 4, opacity: 0.85 },
  value: { width: 116, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
