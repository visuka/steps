import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { fontFor } from '@/constants/themes/fonts';
import { useTheme } from '@/hooks/use-theme';

import { heroColors } from './hero-colors';
import { HOUR_CHART, hourBars, hourBarsLabel } from './hour-bars-geometry';

export interface HourBarsProps {
  /** Steps for hours 0 to 23. */
  hours: readonly number[];
  goal: number;
  /** Defaults to the parent's width. */
  width?: number;
  height?: number;
  /** Today's current hour: later hours are drawn quiet. Omit for past days. */
  now?: number | null;
  /** 'hero' on the blue block, 'plain' on white (the hourly detail screen). */
  tone?: 'hero' | 'plain';
}

/**
 * The 24-bar hour chart of spec 5.4. Back to front: quiet bars, goal line,
 * "goal pace" label, counted bars. One SVG, one spoken summary.
 */
export function HourBars({ hours, goal, width, now, tone = 'hero', height = HOUR_CHART.height }: HourBarsProps) {
  const theme = useTheme();
  const [measured, setMeasured] = useState(0);
  const w = width ?? measured;
  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);

  const hero = heroColors(theme);
  const colors =
    tone === 'hero'
      ? { bar: hero.strong, quiet: hero.quietBar, line: hero.goalLine, label: hero.label }
      : { bar: theme.primary, quiet: theme.secondaryContainer, line: theme.outlineVariant, label: theme.onSurfaceVariant };

  // Until measured, an empty box of the right height (it reports its width).
  if (w <= 0) return <View style={{ height, alignSelf: 'stretch' }} onLayout={onLayout} />;

  const g = hourBars({ hours, goal, width: w, now });
  const rect = (b: (typeof g.bars)[number], i: number, fill: string) => (
    <Rect key={i} x={b.x} y={b.y} width={b.width} height={b.height} rx={b.rx} fill={fill} />
  );
  return (
    <View style={{ height, alignSelf: width ? undefined : 'stretch' }} onLayout={width ? undefined : onLayout}>
      <Svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${HOUR_CHART.height}`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={hourBarsLabel(hours, goal)}>
        {g.bars.map((b, i) => (b.quiet ? rect(b, i, colors.quiet) : null))}
        {g.goalLineY != null ? (
          <Line
            x1={0}
            x2={w}
            y1={g.goalLineY}
            y2={g.goalLineY}
            stroke={colors.line}
            strokeWidth={HOUR_CHART.goalStroke}
            strokeDasharray={HOUR_CHART.goalDash.join(' ')}
          />
        ) : null}
        {g.goalLineY != null ? (
          <SvgText
            x={w}
            y={HOUR_CHART.labelBaseline}
            textAnchor="end"
            fontFamily={fontFor(CLEAN_SPEC.weights.regular)}
            fontSize={HOUR_CHART.labelFontSize}
            fill={colors.label}>
            {HOUR_CHART.labelText}
          </SvgText>
        ) : null}
        {g.bars.map((b, i) => (b.quiet ? null : rect(b, i, colors.bar)))}
      </Svg>
    </View>
  );
}
