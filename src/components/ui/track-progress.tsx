import { type ReactNode, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { type DataTone, Motion, toneColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { standardTiming } from './motion';
import { lapPosition, pointOnTrack, trackPath, trackShape } from './track-geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TICKS = 10;

export interface TrackProgressProps {
  /** How far along, e.g. today's steps. */
  value: number;
  /** One lap, e.g. the daily goal. Past it the lane stays full and the runner starts the next lap. */
  goal: number;
  tone?: DataTone;
  /** Width ÷ height of the oval; the track fills the width it is given. */
  aspect?: number;
  /** Caps the height, e.g. to keep the hero near 45% of the screen. */
  maxHeight?: number;
  /** Lane width in dp. */
  lane?: number;
  /** What a screen reader says, e.g. "5,600 of 8,000 steps". */
  accessibilityLabel: string;
  /** The infield: the big number and what sits under it. */
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * The oval running track: the covered distance painted in the data colour,
 * white ticks every 10%, and a runner dot that travels to the new position
 * in one Material-standard move (600 ms) whenever `value` changes. Reduce
 * motion makes the move a cut. The first draw is already in place.
 */
export function TrackProgress({
  value,
  goal,
  tone = 'steps',
  aspect = 1.5,
  maxHeight,
  lane = 24,
  accessibilityLabel,
  children,
  style,
}: TrackProgressProps) {
  const theme = useTheme();
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  // Until measured, assume the usual 16 dp gutters, so the first frame already has the track.
  const width = measured || Math.max(0, Math.min(win.width, 640) - 32);
  const laps = goal > 0 ? value / goal : 0;
  const progress = useSharedValue(laps);

  useEffect(() => {
    progress.value = withTiming(laps, standardTiming(Motion.duration.runner));
  }, [laps, progress]);

  const height = width ? Math.min(width / aspect, maxHeight ?? Number.POSITIVE_INFINITY) : 0;
  const shape = trackShape(width, height, lane);
  const runnerSize = lane - 4;

  const fillProps = useAnimatedProps(() => {
    const { covered } = lapPosition(progress.value);
    return { strokeDashoffset: shape.perimeter * (1 - covered) };
  });

  const runnerStyle = useAnimatedStyle(() => {
    const { runner } = lapPosition(progress.value);
    const p = pointOnTrack(shape, runner);
    return { transform: [{ translateX: p.x - runnerSize / 2 }, { translateY: p.y - runnerSize / 2 }] };
  });

  // A hidden tab reports 0: keep the last real width rather than drawing nothing.
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setMeasured(w);
  };
  const fill = toneColors(theme, tone).fill;
  const ticks = Array.from({ length: TICKS }, (_, k) => {
    const p = pointOnTrack(shape, k / TICKS);
    const half = lane / 2;
    return { k, x1: p.x - p.nx * half, y1: p.y - p.ny * half, x2: p.x + p.nx * half, y2: p.y + p.ny * half };
  });

  return (
    <View
      style={[styles.wrap, { height: height || undefined }, style]}
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, laps) * 100) }}>
      {width ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Path d={trackPath(shape)} stroke={theme.lane} strokeWidth={lane} fill="none" />
            <AnimatedPath
              d={trackPath(shape)}
              stroke={fill}
              strokeWidth={lane}
              strokeDasharray={[shape.perimeter, shape.perimeter]}
              strokeLinecap="butt"
              fill="none"
              animatedProps={fillProps}
            />
            {ticks.map((t) => (
              <Line
                key={t.k}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={theme.tick}
                strokeWidth={t.k === 0 ? 4 : 2}
              />
            ))}
          </Svg>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.runner,
              {
                width: runnerSize,
                height: runnerSize,
                borderRadius: runnerSize / 2,
                backgroundColor: theme.onSurface,
                borderColor: theme.surface,
              },
              runnerStyle,
            ]}
          />
          <View pointerEvents="box-none" style={[styles.infield, { margin: lane + 8 }]}>
            {children}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  runner: { position: 'absolute', left: 0, top: 0, borderWidth: 2 },
  infield: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
