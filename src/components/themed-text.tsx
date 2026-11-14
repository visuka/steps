import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { ActiveTheme, Fonts, type ThemeColor, Type, type TypeRole } from '@/constants/theme';
import { faceForWeight } from '@/constants/themes/build';
import { useTheme } from '@/hooks/use-theme';

import { useToneInk } from './ui/tone-surface';

/** Older names, mapped onto the Material type scale so existing screens follow the new world. */
type LegacyType = 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';

export type ThemedTextProps = TextProps & {
  /** A Material type role (bodyLarge, titleMedium, labelLarge, numeralHero…). Defaults to bodyLarge. */
  type?: TypeRole | LegacyType;
  /** A colour role; defaults to onSurface (ink). */
  themeColor?: ThemeColor;
};

const LEGACY: Record<LegacyType, TextStyle> = {
  default: Type.bodyLarge,
  small: Type.bodyMedium,
  smallBold: Type.labelLarge,
  subtitle: Type.headlineMedium,
  title: Type.displaySmall,
  link: Type.labelLarge,
  linkPrimary: Type.labelLarge,
  code: { ...Type.bodySmall, fontFamily: Fonts.mono },
};

/** Ink roles that follow a tone plate's `on` colour when the text sits on one. */
const INK_ROLES: readonly (ThemeColor | undefined)[] = [undefined, 'onSurface', 'onSurfaceVariant', 'onBackground', 'primary'];

/**
 * Text in the active theme. Every size comes from the type scale and
 * follows the phone's text-size setting. A fontWeight in `style` picks the
 * matching file of the theme's face instead of letting Android fake a bold, so
 * older screens that say `fontWeight: 700` still get the real Bold. On a tone
 * plate (a filled tile) ink text takes the plate's `on` colour.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const plate = useToneInk();
  const base = type in LEGACY ? LEGACY[type as LegacyType] : Type[type as TypeRole];
  const role = themeColor ?? (type === 'linkPrimary' ? 'primary' : undefined);
  const color = plate && INK_ROLES.includes(role) ? plate.ink : theme[role ?? 'onSurface'];
  const numeral = !(type in LEGACY) && !!ActiveTheme.type[type as TypeRole].numeral;
  return <Text style={resolveFont([{ color }, base, style], numeral)} {...rest} />;
}

/**
 * Flattens a text style and swaps fontWeight for the loaded face of that
 * weight. `numeral` says the text is a numeral role, for a file the theme uses
 * as both a UI and a numeral weight.
 */
export function resolveFont(style: TextProps['style'], numeral = false): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight, ...restStyle } = flat;
  if (fontWeight === undefined) return flat;
  const face = faceForWeight(Fonts, flat.fontFamily, fontWeight, numeral);
  // Some other face (monospace): leave it as it was asked for.
  return face ? { ...restStyle, fontFamily: face } : flat;
}
