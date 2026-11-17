/**
 * The plain look's pieces (plain-theme.ts has every value): the grey ground,
 * glass tiles, mono labels with coloured icons, the figures, buttons, the
 * top row with the Nutrition · Activity · Meet switch, and the sync line.
 * 1 mockup px = 1 dp, through scaled() like the rest of the app.
 */

import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextStyle, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { MaxTextScale } from '@/constants/theme';
import { scaled } from '@/constants/ui-scale';

import { PlainCalendar, PlainIcon } from './plain-icons';
import { PLAIN, PLAIN_FONT, PLAIN_SIZE, type PlainIconName } from './plain-theme';

const S = scaled;

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
      style={[{ fontFamily: family, fontSize: S(size), lineHeight: S(line ?? Math.round(size * 1.2)), color, includeFontPadding: false }, style]}>
      {children}
    </Text>
  );
}

/** A small note: 13 grey, 2 under what it follows. */
export function Note({ children, style, color = PLAIN.muted, size = 13, lines }: { children: ReactNode; style?: TextStyle | TextStyle[]; color?: string; size?: number; lines?: number }) {
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

/** Mono capitals, 11 grey, tracked 1.6: "STEPS TODAY", "06:00 – 15:45". */
export function Caps({ text, color = PLAIN.muted }: { text: string; color?: string }) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: PLAIN_FONT.mono, fontSize: S(11), lineHeight: S(15), letterSpacing: S(1.6), color, includeFontPadding: false }}>
      {text.toUpperCase()}
    </Text>
  );
}

/** A big light figure in the condensed face: 76/78 (104/104 roomy, 64/66 on Nutrition). */
export function Big({ text, size, line }: { text: string; size: number; line: number }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      maxFontSizeMultiplier={MaxTextScale}
      style={{ fontFamily: PLAIN_FONT.condensedLight, fontSize: S(size), lineHeight: S(line), letterSpacing: -1, color: PLAIN.text, includeFontPadding: false, flexShrink: 1 }}>
      {text}
    </Text>
  );
}

/** A tile's figure, light condensed 34/38 (44/48 roomy), with its unit small and grey: "4.6 km". */
export function Num({ value, unit, roomy, style }: { value: string; unit?: string; roomy?: boolean; style?: TextStyle }) {
  const size = roomy ? 44 : 34;
  const line = roomy ? 48 : 38;
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={MaxTextScale}
      style={[{ fontFamily: PLAIN_FONT.condensedLight, fontSize: S(size), lineHeight: S(line), color: PLAIN.text, includeFontPadding: false, marginTop: S(4) }, style]}>
      {value}
      {unit ? <Text style={styles.unit}>{` ${unit}`}</Text> : null}
    </Text>
  );
}

/** A middle figure, condensed 22/26: "78%", "320", "By walker ID". */
export function Mid({ value, unit, style, fit }: { value: string; unit?: string; style?: TextStyle; fit?: boolean }) {
  return (
    <Text
      numberOfLines={fit ? 1 : undefined}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.75 : undefined}
      maxFontSizeMultiplier={MaxTextScale}
      style={[{ fontFamily: PLAIN_FONT.condensed, fontSize: S(22), lineHeight: S(26), color: PLAIN.text, includeFontPadding: false }, style]}>
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
export function Btn({ text, kind = 'chip', onPress, label }: { text: string; kind?: BtnKind; onPress: () => void; label?: string }) {
  const b = BTN[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? text}
      hitSlop={6}
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

/** A segmented switch on glass: mono capitals, the chosen part in sage. */
export function Segments<T extends string>({
  parts,
  value,
  onChange,
  height = PLAIN_SIZE.switchH,
  font = 11.5,
  pad = 11,
  spoken,
}: {
  parts: { value: T; text: string }[];
  value: T;
  onChange: (v: T) => void;
  height?: number;
  font?: number;
  pad?: number;
  spoken?: (v: T) => string;
}) {
  return (
    <View accessibilityRole="tablist" style={[styles.switch, { height: S(height), borderRadius: S(height / 2) }]}>
      {parts.map((p) => {
        const on = p.value === value;
        return (
          <Pressable
            key={p.value}
            onPress={() => onChange(p.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={spoken ? spoken(p.value) : p.text}
            style={[styles.part, { paddingHorizontal: S(pad), borderRadius: S(height / 2 - 3) }, on ? { backgroundColor: PLAIN.main } : null]}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={MaxTextScale}
              style={{ fontFamily: PLAIN_FONT.mono, fontWeight: '500', fontSize: S(font), letterSpacing: S(1.2), color: on ? PLAIN.onMain : PLAIN.muted, includeFontPadding: false }}>
              {p.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type Part = 'nutrition' | 'activity' | 'meet';

const PART_ROUTE = { nutrition: '/food', activity: '/', meet: '/plus' } as const;

/**
 * The top row on all three parts: the calendar (left), the switch, the avatar
 * (right, opens Profile). The switch moves between Food, Today and Meet.
 */
export function TopRow({ part, initial, onCalendar }: { part: Part; initial: string; onCalendar: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.top}>
      <Round onPress={onCalendar} label="Calendar: steps by day">
        <PlainCalendar color={PLAIN.text} />
      </Round>
      <Segments<Part>
        parts={[
          { value: 'nutrition', text: 'NUTRITION' },
          { value: 'activity', text: 'ACTIVITY' },
          { value: 'meet', text: 'MEET' },
        ]}
        value={part}
        onChange={(p) => {
          if (p !== part) router.navigate(PART_ROUTE[p]);
        }}
        spoken={(p) => ({ nutrition: 'Nutrition: food', activity: 'Activity: today', meet: 'Meet: chats and walk buddies' })[p]}
      />
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

/** Two tiles side by side, 10 apart. */
export function Pair({ children }: { children: ReactNode }) {
  return <View style={styles.pair}>{children}</View>;
}

export const plainStyles = StyleSheet.create({
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: S(12) },
  cols: { flexDirection: 'row' },
  col: { flex: 1, minWidth: 0 },
  half: { flex: 1, minWidth: 0 },
});

const styles = StyleSheet.create({
  tile: {
    borderRadius: S(PLAIN_SIZE.radius),
    borderWidth: 1,
    boxShadow: '0px 8px 24px rgba(40, 40, 50, 0.06)',
  },
  label: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 },
  unit: { fontFamily: PLAIN_FONT.regular, fontWeight: '400', fontSize: S(14), color: PLAIN.muted, letterSpacing: 0 },
  field: {
    height: S(42),
    borderRadius: S(21),
    backgroundColor: PLAIN.field,
    borderWidth: 1,
    borderColor: PLAIN.fieldEdge,
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
    boxShadow: '0px 8px 24px rgba(40, 40, 50, 0.06)',
  },
  switch: {
    padding: 3,
    flexDirection: 'row',
    backgroundColor: PLAIN.tile,
    borderWidth: 1,
    borderColor: PLAIN.tileEdge,
    boxShadow: '0px 8px 24px rgba(40, 40, 50, 0.06)',
  },
  part: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S(10) },
  sub: { fontFamily: PLAIN_FONT.regular, fontSize: S(15), lineHeight: S(19), color: PLAIN.muted, includeFontPadding: false },
  pair: { flexDirection: 'row', gap: S(10) },
});
