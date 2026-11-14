import { type ReactNode, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { type DataTone, Look, Motion, toneColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { standardTiming } from './motion';
import { ProgressHero } from './progress-hero';
import { fitTrackHeight, INFIELD_GAP, lapPosition, pointOnTrack, trackPath, trackShape } from './track-geometry';

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
  /** Under a ring or bar hero: a row of figures (distance, minutes). The oval track has none. */
  footer?: ReactNode;
  style?: ViewStyle;
}

/** How the hero's text lines up: centred in a track or ring, from the left over a bar. */
export const heroAlign: 'center' | 'left' = Look.hero === 'track' || Look.hero === 'ring' ? 'center' : 'left';

/**
 * A progress hero, drawn as the theme's `hero` says: the oval running track
 * (below), a ring, a bar, or a bar on a block of the tone's colour
 * (progress-hero.tsx). Today's steps and Food's day energy use it.
 */
export function TrackProgress(props: TrackProgressProps) {
  return Look.hero === 'track' ? <OvalTrack {...props} /> : <ProgressHero {...props} />;
}

/**
 * The oval running track: the covered distance painted in the data colour,
 * ticks every 10%, and a runner dot that travels to the new position
 * in one Material-standard move (600 ms) whenever `value` changes. Reduce
 * motion makes the move a cut. The first draw is already in place.
 */
function OvalTrack({
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
  // The infield content's own height: at large text sizes the track grows to keep it inside the lane.
  const [content, setContent] = useState(0);
  // Until measured, assume the usual 16 dp gutters, so the first frame already has the track.
  const width = measured || Math.max(0, Math.min(win.width, 640) - 32);
  const laps = goal > 0 ? value / goal : 0;
  const progress = useSharedValue(laps);

  useEffect(() => {
    progress.value = withTiming(laps, standardTiming(Motion.duration.runner));
  }, [laps, progress]);

  const base = width ? Math.min(width / aspect, maxHeight ?? Number.POSITIVE_INFINITY) : 0;
  const height = width ? fitTrackHeight(base, content, width, lane) : 0;
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
  const paint = toneColors(theme, tone);
  const fill = paint.fill;
  // Ticks over the covered part take the tone's on colour; on the lane still to go, laneTick.
  const covered = lapPosition(laps).covered;
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
                stroke={t.k / TICKS <= covered && covered > 0 ? paint.on : theme.laneTick}
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
          <View pointerEvents="box-none" style={[styles.infield, { margin: lane + INFIELD_GAP }]}>
            <View
              pointerEvents="box-none"
              style={styles.content}
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                if (h > 0 && h !== content) setContent(h);
              }}>
              {children}
            </View>
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
  content: { alignSelf: 'stretch', alignItems: 'center' },
});
