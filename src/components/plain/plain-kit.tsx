/**
 * The plain look's pieces (plain-theme.ts has every value): the grey ground,
 * glass tiles, mono labels with coloured icons, the figures, buttons, the
 * top row (calendar, avatar), the part switch (drawn by part-bar.tsx) and the sync line.
 * 1 mockup px = 1 dp, through scaled() like the rest of the app.
 */

import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextStyle, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { keepTogetherChildren } from '@/components/text-breaks';
import { MaxTextScale } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';

import { PlainCalendar, PlainIcon } from './plain-icons';
import { PLAIN, PLAIN_FIELD, PLAIN_FONT, PLAIN_SHADOW, PLAIN_SIZE, type PlainIconName } from './plain-theme';

const S = scaled;
/** A text size through scaled(), never under 11 dp (small phones shrink the layout to 0.85). */
const T = (size: number) => Math.max(PLAIN_SIZE.minText, S(size));

/** The page behind everything: a 170° grey wash and the mockup's three soft glows. */
export function PlainGround() {
  const g = PLAIN.ground;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="pg" x1="0.41" y1="0" x2="0.59" y2="1">
            <Stop offset="0" stopColor={g.top} />
            <Stop offset="0.55" stopColor={g.mid} />
            <Stop offset="1" stopColor={g.bottom} />
          </LinearGradient>
          <RadialGradient id="glow">
            <Stop offset="0" stopColor={g.glow} stopOpacity="1" />
            <Stop offset="1" stopColor={g.glow} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="shade">
            <Stop offset="0" stopColor={g.shade} stopOpacity="1" />
            <Stop offset="1" stopColor={g.shade} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pg)" />
        {/* The mockup's blurred circles: 280 at top right, 260 grey at left middle, 240 at bottom right. */}
        <Circle cx={S(411 + 80 - 140)} cy={S(-60 + 140)} r={S(200)} fill="url(#glow)" />
        <Circle cx={S(-120 + 130)} cy={S(380 + 130)} r={S(190)} fill="url(#shade)" />
        <Circle cx={S(411 + 90 - 120)} cy={S(640 + 120)} r={S(175)} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

type Kind = 'plain' | 'hero' | 'second';

const FILL: Record<Kind, { backgroundColor: string; borderColor: string }> = {
  plain: { backgroundColor: PLAIN.tile, borderColor: PLAIN.tileEdge },
  hero: { backgroundColor: PLAIN.hero, borderColor: PLAIN.heroEdge },
  second: { backgroundColor: PLAIN.second, borderColor: PLAIN.secondEdge },
};

/** A frosted tile: radius 24, white hairline, a soft shadow. Pressable when it has `onPress`. */
export function Tile({
  kind = 'plain',
  roomy,
  onPress,
  label,
  style,
  children,
}: {
  kind?: Kind;
  roomy?: boolean;
  onPress?: () => void;
  /** What a screen reader says for the whole tile (with onPress). */
  label?: string;
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
}) {
  const pad = roomy ? PLAIN_SIZE.padRoomy : PLAIN_SIZE.pad;
  const box = [styles.tile, FILL[kind], { paddingVertical: S(pad.v), paddingHorizontal: S(pad.h) }, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: PLAIN.ripple, foreground: true }} style={box}>
      {children}
    </Pressable>
  );
}

/** Words in Figtree at the mockup's size (line height 1.2 × size unless given). */
export function Words({
  size,
  weight = 400,
  color = PLAIN.text,
  line,
  lines,
  fit,
  style,
  children,
}: {
  size: number;
  weight?: 400 | 500 | 600;
  color?: string;
  line?: number;
  lines?: number;
  fit?: boolean;
  style?: TextStyle | TextStyle[];
  children: ReactNode;
}) {
  const family = weight === 600 ? PLAIN_FONT.semibold : weight === 500 ? PLAIN_FONT.medium : PLAIN_FONT.regular;
  return (
    <Text
      numberOfLines={fit ? 1 : lines}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.75 : undefined}
      maxFontSizeMultiplier={MaxTextScale}
      textBreakStrategy="balanced"
      lineBreakStrategyIOS="standard"
      style={[{ fontFamily: family, fontSize: T(size), lineHeight: Math.max(T(size), S(line ?? Math.round(size * 1.2))), color, includeFontPadding: false }, style]}>
      {keepTogetherChildren(children)}
    </Text>
  );
}

/** A small note: 14 grey, 2 under what it follows. */
export function Note({ children, style, color = PLAIN.muted, size = 14, lines }: { children: ReactNode; style?: TextStyle | TextStyle[]; color?: string; size?: number; lines?: number }) {
  return (
    <Words size={size} color={color} lines={lines} style={[{ marginTop: S(2) }, ...(Array.isArray(style) ? style : style ? [style] : [])]}>
      {children}
    </Words>
  );
}

/** A tile's label: its coloured icon and a name in tracked mono capitals. */
export function Label({ icon, text, style }: { icon?: PlainIconName; text: string; style?: ViewStyle }) {
  return (
    <View style={[styles.label, style]}>
      {icon ? (
        <View style={{ marginRight: S(8), marginVertical: -S(4) }}>
          <PlainIcon name={icon} size={S(17)} />
        </View>
      ) : null}
      <Caps text={text} />
    </View>
  );
}

/** Caps tracking steps: the shared 2, then only as much tighter as a long label needs. */
const CAPS_TRACK = [2, 1.5, 1, 0.75] as const;

/**
 * Outfit 500 capitals, 11.5 label grey, tracked 2: "STEPS TODAY", "06:00 – 15:45".
 * Where a long label would not fit on one line (a half tile at 360 dp), it keeps
 * its 11 dp size (rule: smallest text 11) and tightens its tracking one step at a
 * time (CAPS_TRACK), so it stays inside the tile's padding and a near fit stays
 * close to its neighbours' tracking. The space after the last capital is not counted.
 * A label too long even at the tightest step wraps whole rather than being cut.
 */
export function Caps({ text, color = PLAIN.label }: { text: string; color?: string }) {
  const [lvl, setLvl] = useState(0);
  const last = CAPS_TRACK.length - 1;
  const track = S(CAPS_TRACK[lvl]);
  return (
    <Text
      onTextLayout={lvl < last ? (e) => e.nativeEvent.lines.length > 1 && setLvl(lvl + 1) : undefined}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: PLAIN_FONT.caps, fontSize: T(11.5), lineHeight: Math.max(S(15), T(11.5) + 3), letterSpacing: track, marginRight: -track, color, includeFontPadding: false, flexShrink: 1 }}>
      {text.toUpperCase()}
    </Text>
  );
}

/** A big figure, Outfit 300 tracked −2: 96/100 on Activity, 64/66 on Nutrition. */
export function Big({ text, size, line }: { text: string; size: number; line: number }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: PLAIN_FONT.figure, fontSize: S(size), lineHeight: S(line), letterSpacing: -S(2), color: PLAIN.text, includeFontPadding: false, flexShrink: 1 }}>
      {text}
    </Text>
  );
}

/** A tile's figure, Outfit 300 34/38 (38/46 roomy: Outfit is wider), with its unit 15 grey: "4.6 km". */
// `pairs`: a figure in parts, each with its small unit (Sleep: 6 h 50 m, as mock d38).
export function Num({ value, unit, roomy, style, pairs }: { value: string; unit?: string; roomy?: boolean; style?: TextStyle; pairs?: [string, string][] }) {
  const size = roomy ? 38 : 34;
  const line = roomy ? 46 : 38;
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={MaxTextScale}
      style={[{ fontFamily: PLAIN_FONT.figure, fontSize: S(size), lineHeight: S(line), color: PLAIN.text, includeFontPadding: false, marginTop: S(4) }, style]}>
      {pairs
        ? pairs.map(([n, u], i) => (
            <Text key={i}>
              {i > 0 ? ' ' : ''}
              {n}
              <Text style={styles.unit}>{` ${u}`}</Text>
            </Text>
          ))
        : value}
      {unit && !pairs ? <Text style={styles.unit}>{` ${unit}`}</Text> : null}
    </Text>
  );
}

/** A middle figure, Outfit 400 22/26: "78%", "320", "By walker ID". */
export function Mid({ value, unit, style, fit }: { value: string; unit?: string; style?: TextStyle; fit?: boolean }) {
  return (
    <Text
      numberOfLines={fit ? 1 : undefined}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.75 : undefined}
      maxFontSizeMultiplier={MaxTextScale}
      style={[{ fontFamily: PLAIN_FONT.mid, fontSize: S(22), lineHeight: S(26), color: PLAIN.text, includeFontPadding: false }, style]}>
      {value}
      {unit ? <Text style={styles.unit}>{` ${unit}`}</Text> : null}
    </Text>
  );
}

/** The white search field: 42 high, round ends, 14 words, a grey hairline. */
export function Field({
  value,
  onChangeText,
  placeholder,
  label,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={PLAIN.muted}
      cursorColor={PLAIN.main}
      selectionColor={PLAIN.main}
      accessibilityLabel={label}
      autoFocus={autoFocus}
      onSubmitEditing={onSubmit}
      returnKeyType="search"
      maxFontSizeMultiplier={MaxTextScale}
      style={styles.field}
    />
  );
}

type BtnKind = 'chip' | 'main' | 'onSecond';
const BTN: Record<BtnKind, { bg: string; ink: string }> = {
  chip: { bg: PLAIN.chip, ink: PLAIN.text },
  main: { bg: PLAIN.main, ink: PLAIN.onMain },
  onSecond: { bg: PLAIN.chipOnSecond, ink: PLAIN.text },
};

/** A small pill button: 13 semibold, 8 × 16 padding, radius 18. */
/** The pill is about 32 tall (27 on the smallest scale); 11 above and below keeps the tap area at 48 or more. */
const BTN_SLOP = { top: 11, bottom: 11, left: 6, right: 6 };

export function Btn({ text, kind = 'chip', onPress, label }: { text: string; kind?: BtnKind; onPress: () => void; label?: string }) {
  const b = BTN[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? text}
      hitSlop={BTN_SLOP}
      android_ripple={{ color: PLAIN.ripple, foreground: true }}
      style={[styles.btn, { backgroundColor: b.bg }]}>
      <Words size={13} weight={600} color={b.ink} line={16} lines={1}>
        {text}
      </Words>
    </Pressable>
  );
}

/** A 40 round button. `main`: sage with a white plus (Water's add). */
export function Round({ onPress, label, main, children }: { onPress: () => void; label: string; main?: boolean; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      android_ripple={{ color: PLAIN.ripple, foreground: true, borderless: false }}
      style={[styles.round, main ? { backgroundColor: PLAIN.main, borderColor: PLAIN.main } : FILL.plain]}>
      {children}
    </Pressable>
  );
}

/**
 * A segmented switch on glass: Outfit capitals, the chosen part in sage. `quiet` (a second switch on the
 * same screen, Today / Week): the chosen part is a white pill with ink words, so each screen has one sage pill.
 */
export function Segments<T extends string>({
  parts,
  value,
  onChange,
  height = PLAIN_SIZE.switchH,
  font = 11.5,
  pad = 11,
  spoken,
  quiet,
  stretch,
}: {
  parts: { value: T; text: string }[];
  value: T;
  onChange: (v: T) => void;
  height?: number;
  font?: number;
  pad?: number;
  spoken?: (v: T) => string;
  quiet?: boolean;
  /** Fill the row, each part an equal share (a screen's Day / Week / Month). */
  stretch?: boolean;
}) {
  const onFill = quiet ? styles.quietOn : { backgroundColor: PLAIN.main };
  const onInk = quiet ? PLAIN.text : PLAIN.onMain;
  return (
    <View accessibilityRole="tablist" style={[styles.switch, { height: S(height), borderRadius: S(height / 2) }, stretch ? styles.stretch : null]}>
      {parts.map((p) => {
        const on = p.value === value;
        return (
          <Pressable
            key={p.value}
            onPress={() => onChange(p.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={spoken ? spoken(p.value) : p.text}
            style={[styles.part, { paddingHorizontal: S(pad), borderRadius: S(height / 2 - 3) }, stretch ? styles.share : null, on ? onFill : null]}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={MaxTextScale}
              style={{ fontFamily: PLAIN_FONT.caps, fontSize: T(font), letterSpacing: S(1.6), color: on ? onInk : PLAIN.muted, includeFontPadding: false }}>
              {p.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The top row on all three parts: the calendar (left) and the avatar (right,
 * opens Profile). The part switch is the bar at the bottom (part-bar.tsx).
 */
export function TopRow({ initial, onCalendar }: { initial: string; onCalendar: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.top}>
      <Round onPress={onCalendar} label="Calendar: steps by day">
        <PlainCalendar color={PLAIN.text} />
      </Round>
      <Round onPress={() => router.navigate('/you')} label="Your profile">
        {initial ? (
          <Words size={16} weight={600} line={20}>
            {initial}
          </Words>
        ) : (
          <PlainIcon name="people" color={PLAIN.text} size={S(18)} stroke={1.6} />
        )}
      </Round>
    </View>
  );
}

/** The line under the top row: a bold lead and grey words after it, one line. */
export function Sub({ lead, rest, children }: { lead: string; rest?: string; children?: ReactNode }) {
  return (
    <View style={styles.subRow}>
      <Text numberOfLines={1} maxFontSizeMultiplier={MaxTextScale} style={[styles.sub, { flexShrink: 1 }]}>
        <Text style={{ fontFamily: PLAIN_FONT.semibold, color: PLAIN.text }}>{lead}</Text>
        {rest ? ` · ${rest}` : ''}
      </Text>
      {children}
    </View>
  );
}

/** The quiet line at the foot: "Updated 2 min ago". */
export function SyncLine({ text, bottom = 24 }: { text: string; bottom?: number }) {
  return (
    <Words size={12} color={PLAIN.muted} style={{ textAlign: 'center', marginTop: 'auto', paddingTop: S(8), marginBottom: S(bottom) }}>
      {text}
    </Words>
  );
}

/** Two tiles side by side, 10 apart, the same height (a button row with `footRow` sits at each tile's foot, on one line). */
export function Pair({ children }: { children: ReactNode }) {
  return <View style={styles.pair}>{children}</View>;
}

export const plainStyles = StyleSheet.create({
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: S(12) },
  cols: { flexDirection: 'row' },
  col: { flex: 1, minWidth: 0 },
  half: { flex: 1, minWidth: 0 },
  /** A tile's last row of buttons, pushed to its foot so paired tiles' buttons line up (d38): 12 under the words at least. */
  footRow: { flexDirection: 'row', alignItems: 'center', gap: S(12), marginTop: 'auto', paddingTop: S(12) },
});

const styles = StyleSheet.create({
  tile: {
    borderRadius: S(PLAIN_SIZE.radius),
    borderWidth: 1,
    boxShadow: PLAIN_SHADOW,
  },
  label: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 },
  unit: { fontFamily: PLAIN_FONT.regular, fontWeight: '400', fontSize: S(15), color: PLAIN.muted, letterSpacing: 0 },
  field: {
    ...PLAIN_FIELD,
    height: S(42),
    borderRadius: S(PLAIN_FIELD.borderRadius),
    paddingHorizontal: S(16),
    paddingVertical: 0,
    fontFamily: PLAIN_FONT.regular,
    fontSize: S(14),
    color: PLAIN.text,
    includeFontPadding: false,
  },
  btn: { paddingVertical: S(8), paddingHorizontal: S(16), borderRadius: S(18), overflow: 'hidden' },
  round: {
    width: S(PLAIN_SIZE.round),
    height: S(PLAIN_SIZE.round),
    borderRadius: S(PLAIN_SIZE.round / 2),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: PLAIN_SHADOW,
  },
  switch: {
    padding: 3,
    flexDirection: 'row',
    backgroundColor: PLAIN.tile,
    borderWidth: 1,
    borderColor: PLAIN.tileEdge,
    boxShadow: PLAIN_SHADOW,
  },
  part: { alignItems: 'center', justifyContent: 'center' },
  stretch: { alignSelf: 'stretch' },
  share: { flex: 1, minWidth: 0 },
  quietOn: { backgroundColor: PLAIN.quietOn, boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S(10) },
  sub: { fontFamily: PLAIN_FONT.regular, fontSize: S(15), lineHeight: S(19), color: PLAIN.muted, includeFontPadding: false },
  pair: { flexDirection: 'row', gap: S(10) },
});
