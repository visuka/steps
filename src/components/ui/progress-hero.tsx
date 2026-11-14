import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Look, Motion, Spacing, toneColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { heroColors } from './hero-colors';
import { standardTiming } from './motion';
import { HERO_STYLE } from './progress-hero-style';
import { TickBar } from './tick-bar';
import { toneInk, ToneInkContext, useInCard, useToneInk } from './tone-surface';
import type { TrackProgressProps } from './track-progress';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The ring's outer size, dp; it grows when large text needs the room. */
const RING = 192;
const RING_STROKE = 12;
/** The hero bar's thickness, dp. */
const BAR = 16;

/**
 * The heroes that aren't the oval track (TrackProgress picks by the theme's `hero`):
 * - ring: the number inside a circular ring, figures under it.
 * - bar: the number from the left, a thick bar under it, figures under that.
 * - block: as bar, on a block of the tone's container colour (Colour blocks); in
 *   Clean+ (Look.tile 'plain') the block is the accent blue, with white ink and
 *   the quiet bar colours of spec 2 (see hero-colors.ts).
 * Outside a Card each draws its own plate; inside one it uses the card's.
 * Past the goal the ring or bar stays full; the text says the goal is done.
 */
export function ProgressHero({
  value,
  goal,
  tone = 'steps',
  maxHeight,
  accessibilityLabel,
  children,
  footer,
  style,
}: TrackProgressProps) {
  const theme = useTheme();
  const inCard = useInCard();
  const outer = useToneInk();
  // Clean+: the hero block is blue, not a tint, so ink, track and fill come from heroColors.
  const blue = Look.hero === 'block' && Look.tile === 'plain' && !inCard && !outer;
  const hero = heroColors(theme);
  const share = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;

  const a11y = {
    accessible: true,
    accessibilityRole: 'progressbar' as const,
    accessibilityLabel,
    accessibilityValue: { min: 0, max: 100, now: Math.round(share * 100) },
  };

  const body =
    Look.hero === 'ring' ? (
      <View style={styles.ringColumn}>
        <Ring share={share} tone={tone} max={maxHeight} fill={blue ? hero.strong : undefined} {...a11y}>
          {children}
        </Ring>
        {footer}
      </View>
    ) : (
      <View style={styles.barColumn}>
        <View {...a11y}>{children}</View>
        <TickBar value={value} max={goal} tone={tone} color={blue ? hero.strong : undefined} height={BAR} />
        {footer}
      </View>
    );

  // Already on a plate (a card, or a toned card): no second one.
  if (inCard || outer) return <View style={style}>{body}</View>;

  if (Look.hero === 'block') {
    const ink = blue ? { ...toneInk(theme, tone), plate: theme.primary, ink: theme.onPrimary, lane: hero.quietBar } : toneInk(theme, tone);
    return (
      <ToneInkContext value={ink}>
        <View style={[styles.plate, { backgroundColor: ink.plate }, style]}>{body}</View>
      </ToneInkContext>
    );
  }
  const plate: ViewStyle =
    Look.tile === 'plain'
      ? { backgroundColor: theme.surfaceContainer }
      : { backgroundColor: theme.surfaceContainerLowest, borderWidth: 1, borderColor: theme.outlineVariant };
  return <View style={[styles.plate, plate, style]}>{body}</View>;
}

function Ring({
  share,
  tone,
  max,
  fill,
  children,
  ...a11y
}: {
  share: number;
  tone: NonNullable<TrackProgressProps['tone']>;
  max?: number;
  /** A fixed arc colour (on the blue hero); the tone's fill when left out. */
  fill?: string;
  children?: ReactNode;
  accessible: boolean;
  accessibilityRole: 'progressbar';
  accessibilityLabel: string;
  accessibilityValue: { min: number; max: number; now: number };
}) {
  const theme = useTheme();
  const plate = useToneInk();
  const [content, setContent] = useState(0);
  // Large text: the ring grows to keep the number inside it.
  const size = Math.max(Math.min(RING, max ?? RING), content + RING_STROKE * 2 + Spacing.four);
  const r = (size - RING_STROKE) / 2;
  const around = 2 * Math.PI * r;
  const progress = useSharedValue(share);
  useEffect(() => {
    progress.value = withTiming(share, standardTiming(Motion.duration.runner));
  }, [share, progress]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: around * (1 - progress.value) }));

  return (
    <View style={{ width: size, height: size }} {...a11y}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={plate ? plate.lane : theme.lane} strokeWidth={RING_STROKE} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fill ?? toneColors(theme, tone).fill}
          strokeWidth={RING_STROKE}
          strokeDasharray={[around, around]}
          strokeLinecap={share > 0 && share < 1 ? 'round' : 'butt'}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          animatedProps={arc}
        />
      </Svg>
      <View pointerEvents="box-none" style={[styles.ringInfield, { margin: RING_STROKE + Spacing.two }]}>
        <View
          pointerEvents="box-none"
          style={styles.ringContent}
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            if (h > 0 && h !== content) setContent(h);
          }}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: HERO_STYLE.radius, padding: HERO_STYLE.padding, overflow: 'hidden' },
  ringColumn: { alignItems: 'center', gap: Spacing.three },
  barColumn: { gap: Spacing.three },
  ringInfield: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringContent: { alignSelf: 'stretch', alignItems: 'center' },
});
