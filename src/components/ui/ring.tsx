import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type DataTone, toneColors } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { clampShare, RING, ringArc, ringLabel, ringSize } from './ring-geometry';

export interface RingProps {
  value: number;
  goal: number;
  /** 40 to 88 dp. */
  size?: number;
  stroke?: number;
  tone?: DataTone;
  /** Centred inside the ring (an icon). */
  children?: ReactNode;
  accessibilityLabel?: string;
}

/** A thin progress ring: lane track, tone arc, butt caps, from 12 o'clock, full at 100 %. */
export function Ring({ value, goal, size = RING.minSize, stroke = RING.defaultStroke, tone = 'steps', children, accessibilityLabel }: RingProps) {
  const theme = useTheme();
  const s = ringSize(size);
  const r = (s - stroke) / 2;
  const share = clampShare(value, goal);
  const arc = ringArc(share, r);
  return (
    <View
      style={{ width: s, height: s }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100), text: ringLabel(value, goal) }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={theme.lane} strokeWidth={stroke} />
        {share > 0 ? (
          <Circle
            cx={s / 2}
            cy={s / 2}
            r={r}
            fill="none"
            stroke={toneColors(theme, tone).fill}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.offset}
            transform={`rotate(-90 ${s / 2} ${s / 2})`}
          />
        ) : null}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
