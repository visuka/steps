import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, numeralFont, type ThemeColor, Type, type TypeRole, uiFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

const NUMERAL_FACES: readonly string[] = [Fonts.numeral, Fonts.numeralMedium];
const UI_FACES: readonly string[] = [Fonts.regular, Fonts.medium, Fonts.semibold, Fonts.bold];

/**
 * Text in the park-track world. Every size comes from the type scale and
 * follows the phone's text-size setting. A fontWeight in `style` picks the
 * matching Barlow file instead of letting Android fake a bold, so older
 * screens that say `fontWeight: 700` still get the real Bold.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const base = type in LEGACY ? LEGACY[type as LegacyType] : Type[type as TypeRole];
  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'primary' : 'onSurface')];
  return <Text style={resolveFont([{ color }, base, style])} {...rest} />;
}

/** Flattens a text style and swaps fontWeight for the loaded face of that weight. */
export function resolveFont(style: TextProps['style']): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight, ...restStyle } = flat;
  if (fontWeight === undefined) return flat;
  const fam = flat.fontFamily;
  if (fam && NUMERAL_FACES.includes(fam)) return { ...restStyle, fontFamily: numeralFont(fontWeight) };
  if (!fam || UI_FACES.includes(fam)) return { ...restStyle, fontFamily: uiFont(fontWeight) };
  // Some other face (monospace): leave it as it was asked for.
  return flat;
}
