import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

import { DONUT, donutColors, donutArcs, donutLabel } from './donut-geometry';

export interface DonutProps {
  /** Grams. */
  protein: number;
  carbs: number;
  fat: number;
  /** The centred icon (a bowl). */
  children?: ReactNode;
}

/** Macro donut, spec 5.12: protein, carbs, fat clockwise from 12 o'clock, butt caps, no track. */
export function Donut({ protein, carbs, fat, children }: DonutProps) {
  const theme = useTheme();
  const arcs = donutArcs(protein, carbs, fat);
  const colors = donutColors(theme);
  return (
    <View style={styles.box} accessible accessibilityRole="image" accessibilityLabel={donutLabel(protein, carbs, fat)}>
      <Svg width={DONUT.size} height={DONUT.size} viewBox={`0 0 ${DONUT.size} ${DONUT.size}`}>
        {arcs.map((a, i) => (
          <Circle
            key={i}
            cx={DONUT.centre}
            cy={DONUT.centre}
            r={DONUT.radius}
            fill="none"
            stroke={colors[i]}
            strokeWidth={DONUT.stroke}
            strokeLinecap="butt"
            strokeDasharray={`${a.len} ${DONUT.circumference}`}
            strokeDashoffset={a.offset}
            transform={`rotate(-90 ${DONUT.centre} ${DONUT.centre})`}
          />
        ))}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: DONUT.size, height: DONUT.size },
  centre: { alignItems: 'center', justifyContent: 'center' },
});
